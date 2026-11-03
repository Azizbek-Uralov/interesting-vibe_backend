import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual, randomUUID } from 'crypto';
import { RedisService } from '../../db/redis/redis.service';
import { env } from '../../db';
import { PrismaService } from '../../db/prisma/prisma.service';
import { OtpPurpose } from '../../../generated/prisma/enums';
import { Eskiz } from '../../infrastructure/Eskiz';
import { TelegramBot } from '../../infrastructure/TelegramBot';

export interface TelegramOtpSession {
  phone: string;
  purpose: OtpPurpose;
  status: 'PENDING' | 'SENT' | 'EXPIRED';
  chatId?: number | string;
  createdAt: number;
  sentAt?: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  normalize(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!/^998\d{9}$/.test(digits)) {
      throw new BadRequestException('Telefon raqami noto‘g‘ri.');
    }
    return `+${digits}`;
  }

  private hashOtp(phone: string, code: string): string {
    return createHmac('sha256', env.OTP.SECRET)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  /**
   * DB da OtpVerification yozuvini yaratish va 6 xonali kodni qaytarish
   */
  async createOtpRecord(
    phone: string,
    purpose: OtpPurpose,
    checkCooldown = true,
  ): Promise<{ code: string; expiresIn: number; resendAfter: number }> {
    const redis = this.redisService.client;
    const resendKey = `otp:resend:${purpose}:${phone}`;

    if (checkCooldown) {
      const cooldown = await redis.set(
        resendKey,
        '1',
        'EX',
        env.OTP.RESEND,
        'NX',
      );

      if (cooldown !== 'OK') {
        const remaining = await redis.ttl(resendKey);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `OTP qayta yuborish uchun ${Math.max(
              remaining,
              1,
            )} sekund kuting`,
            retryAfter: Math.max(remaining, 1),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = this.generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.OTP.TTL * 1000);

    try {
      const user = await this.prisma.user.findUnique({ where: { phone } });
      await this.prisma.$transaction(async (tx) => {
        await tx.otpVerification.updateMany({
          where: { phoneNumber: phone, purpose, consumedAt: null },
          data: { consumedAt: now },
        });
        await tx.otpVerification.create({
          data: {
            phoneNumber: phone,
            purpose,
            codeHash: this.hashOtp(phone, code),
            userId: user?.id,
            expiresAt,
            maxAttempts: env.OTP.ATTEMPTS,
            resendAt: new Date(now.getTime() + env.OTP.RESEND * 1000),
          },
        });
      });

      return {
        code,
        expiresIn: env.OTP.TTL,
        resendAfter: env.OTP.RESEND,
      };
    } catch (error) {
      if (checkCooldown) {
        await redis.del(resendKey);
      }
      this.logger.error('Failed to create OTP record:', error);
      throw new ServiceUnavailableException('OTP yaratishda xatolik yuz berdi.');
    }
  }

  /**
   * Asosiy sendOtp metodi: OTP_PROVIDER ga qarab Eskiz yoki Telegram orqali ishlaydi
   */
  async sendOtp(phoneInput: string, purpose: OtpPurpose) {
    const phone = this.normalize(phoneInput);

    if (env.OTP_PROVIDER === 'ESKIZ') {
      const { code, expiresIn, resendAfter } = await this.createOtpRecord(phone, purpose, true);
      try {
        await Eskiz.sendSms(
          phone.replace(/\D/g, ''),
          `Visual platform tasdiqlash kodi: ${code}`,
        );
        return {
          provider: 'ESKIZ',
          expiresIn,
          resendAfter,
        };
      } catch (error) {
        this.logger.error('Eskiz SMS failed, reverting OTP record:', error);
        await this.prisma.otpVerification.updateMany({
          where: { phoneNumber: phone, purpose, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        await this.redisService.client.del(`otp:resend:${purpose}:${phone}`);
        throw new ServiceUnavailableException(
          'SMS yuborilmadi. Keyinroq qayta urinib ko‘ring.',
        );
      }
    }

    // TELEGRAM PROVIDER
    return this.createTelegramSession(phone, purpose);
  }

  /**
   * Telegram orqali OTP sessiyasi yaratish (Deep link & QR code)
   */
  async createTelegramSession(phone: string, purpose: OtpPurpose) {
    const sessionToken = randomUUID();
    const sessionKey = `telegram:otp:session:${sessionToken}`;
    const ttlSeconds = Math.max(env.OTP.TTL, 300);

    const sessionData: TelegramOtpSession = {
      phone,
      purpose,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    await this.redisService.set(
      sessionKey,
      JSON.stringify(sessionData),
      ttlSeconds,
    );

    const botUsername = env.TELEGRAM.BOT_USERNAME;
    const botUrl = botUsername
      ? `https://t.me/${botUsername}?start=${sessionToken}`
      : `https://t.me?start=${sessionToken}`;

    return {
      provider: 'TELEGRAM',
      sessionToken,
      botUsername,
      botUrl,
      expiresIn: ttlSeconds,
      resendAfter: env.OTP.RESEND,
    };
  }

  /**
   * Telegram bot orqali /start <sessionToken> kelganda kod yaratib yuborish
   */
  async processTelegramStart(
    sessionToken: string,
    chatId: number | string,
  ): Promise<{ success: boolean; message: string }> {
    const sessionKey = `telegram:otp:session:${sessionToken}`;
    const rawData = await this.redisService.get(sessionKey);

    if (!rawData) {
      return {
        success: false,
        message: 'Tasdiqlash sessiyasi topilmadi yoki muddati tugagan.',
      };
    }

    const session: TelegramOtpSession = JSON.parse(rawData);

    // Agar allaqachon kod yuborilgan bo'lsa
    if (session.status === 'SENT') {
      return {
        success: true,
        message: 'Kod allaqachon yuborilgan. Saytga kiritishingiz mumkin.',
      };
    }

    // Yangi OTP yaratish
    const { code } = await this.createOtpRecord(session.phone, session.purpose, false);

    // Telegram chatga chiroyli xabar yuborish
    const text =
      `✨ *Visual Discovery Platform*\n\n` +
      `Sizning bir martalik tasdiqlash kodingiz:\n\n` +
      `👉 \`${code}\` 👈\n\n` +
      `⏱ Amal qilish muddati: ${Math.round(env.OTP.TTL / 60)} daqiqa.\n` +
      `⚠️ *Xavfsizlik eslatmasi:* Ushbu kodni hech kimga, hatto administratorlarga ham bermang!`;

    const sendRes = await TelegramBot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

    if (!sendRes.ok) {
      this.logger.error(`Failed to deliver OTP to Telegram chatId ${chatId}: ${sendRes.description}`);
      return {
        success: false,
        message: 'Telegram orqali xabar yuborishda xatolik yuz berdi.',
      };
    }

    // Redis sessiyasini SENT holatiga o'tkazamiz
    session.status = 'SENT';
    session.chatId = chatId;
    session.sentAt = Date.now();

    await this.redisService.set(
      sessionKey,
      JSON.stringify(session),
      Math.max(env.OTP.TTL, 300),
    );

    return {
      success: true,
      message: 'Tasdiqlash kodi muvaffaqiyatli yuborildi!',
    };
  }

  /**
   * Telegram sessiyasining joriy holatini tekshirish (frontend polling uchun)
   */
  async getTelegramSessionStatus(sessionToken: string) {
    const sessionKey = `telegram:otp:session:${sessionToken}`;
    const rawData = await this.redisService.get(sessionKey);

    if (!rawData) {
      return { status: 'EXPIRED' };
    }

    const session: TelegramOtpSession = JSON.parse(rawData);
    return {
      status: session.status,
      phone: session.phone,
      sentAt: session.sentAt,
    };
  }

  /**
   * OTP ni tasdiqlash (signup / signin / verify jarayonida)
   */
  async verifyOtp(phoneInput: string, code: string, purpose: OtpPurpose) {
    const phone = this.normalize(phoneInput);
    const now = new Date();
    const otp = await this.prisma.otpVerification.findFirst({
      where: {
        phoneNumber: phone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Kod noto‘g‘ri yoki muddati tugagan.');
    }

    if (otp.attempts >= otp.maxAttempts) {
      await this.prisma.otpVerification.updateMany({
        where: { id: otp.id, consumedAt: null },
        data: { consumedAt: now },
      });
      throw new HttpException(
        'Urinishlar soni tugadi. Yangi kod so‘rang.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hashOtp(phone, code), 'hex');
    const matches =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const update = await this.prisma.otpVerification.updateMany({
        where: {
          id: otp.id,
          consumedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: otp.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });

      if (update.count === 0) {
        throw new BadRequestException('Kod noto‘g‘ri yoki muddati tugagan.');
      }

      if (otp.attempts + 1 >= otp.maxAttempts) {
        await this.prisma.otpVerification.updateMany({
          where: { id: otp.id, consumedAt: null },
          data: { consumedAt: now },
        });
        throw new HttpException(
          'Urinishlar soni tugadi. Yangi kod so‘rang.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException('Kod noto‘g‘ri.');
    }

    const consumed = await this.prisma.otpVerification.updateMany({
      where: {
        id: otp.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: otp.maxAttempts },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException('Kod noto‘g‘ri yoki qayta ishlatilgan.');
    }

    return { phone, userId: otp.userId };
  }
}
