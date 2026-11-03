import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { env } from '../../db';
import { TelegramBot, TelegramUpdate } from '../../infrastructure/TelegramBot';
import { OtpService } from './otp.service';

@Injectable()
export class TelegramPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollerService.name);
  private isRunning = false;
  private offset = 0;

  constructor(private readonly otpService: OtpService) {}

  async onModuleInit() {
    if (env.OTP_PROVIDER !== 'TELEGRAM') {
      this.logger.log('OTP_PROVIDER Telegram emas, polling o‘chirilgan.');
      return;
    }

    if (!TelegramBot.isConfigured()) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN belgilanmagan. Telegram bot polling boshlanmadi.',
      );
      return;
    }

    this.isRunning = true;
    this.pollLoop().catch((err) => {
      this.logger.error('Telegram polling loop fatal error:', err);
    });
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  private async pollLoop() {
    this.logger.log('Telegram bot tekshirilmoqda...');
    const me = await TelegramBot.getMe();
    if (me.ok && me.result) {
      this.logger.log(
        `Telegram bot muvaffaqiyatli ulandi: @${me.result.username} (${me.result.first_name})`,
      );
    } else {
      this.logger.warn('Telegram bot tokeni noto‘g‘ri yoki tarmoqqa ulanib bo‘lmadi.');
    }

    this.logger.log('Telegram polling xizmati ishga tushdi.');

    while (this.isRunning) {
      try {
        const res = await TelegramBot.getUpdates(this.offset, 10);

        if (!res.ok) {
          this.logger.warn(`Telegram getUpdates failed: ${res.error}`);
          // Conflict yoki tarmoq xatosi bo'lsa 3 soniya kutamiz
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }

        const updates = res.result;

        if (updates.length > 0) {
          for (const update of updates) {
            this.offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        } else {
          // Hech qanday yangi xabar bo'lmasa 1 soniya kutamiz
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.logger.warn(`Telegram polling interval xatosi: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;

    // 1. Agar foydalanuvchi kontakt ulashsa
    if (message.contact && message.contact.phone_number) {
      this.logger.log(`Telegram kontakt qabul qilindi: ${message.contact.phone_number}`);
      const contactRes = await this.otpService.processTelegramContact(
        message.contact.phone_number,
        chatId,
      );
      if (!contactRes.success) {
        await TelegramBot.sendMessage(
          chatId,
          `⚠️ ${contactRes.message}\n\nIltimos, saytdan qayta urinib ko‘ring.`,
          { parse_mode: 'HTML' },
        );
      }
      return;
    }

    // 2. Agar foydalanuvchi matn yuborsa
    if (!message.text) return;
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const sessionToken = parts[1]?.trim();

      if (sessionToken) {
        // Deep-link bilan kelgan holat: /start <token>
        this.logger.log(`Telegram /start qabul qilindi. Token: ${sessionToken}`);
        const result = await this.otpService.processTelegramStart(sessionToken, chatId);
        if (!result.success) {
          await TelegramBot.sendMessage(
            chatId,
            `⚠️ ${result.message}\n\nIltimos, saytdan qayta kod so‘rang.`,
            { parse_mode: 'HTML' },
          );
        }
      } else {
        // Tokensiz oddiy /start bosilgan holat!
        this.logger.log('Tokensiz /start keldi. Oxirgi pending sessiyani tekshiramiz...');
        const autoRes = await this.otpService.processTelegramLatestPending(chatId);

        if (autoRes.success) {
          this.logger.log('Oxirgi pending sessiya orqali OTP muvaffaqiyatli yuborildi!');
        } else {
          // Agar sessiya topilmasa, kontakt so'rash tugmasini chiqaramiz
          const name = message.from?.first_name ?? 'Foydalanuvchi';
          const welcome =
            `Assalomu alaykum, <b>${name}</b>! 👋\n\n` +
            `Bu <b>Visual Discovery</b> platformasining rasmiy tasdiqlash boti.\n\n` +
            `Tasdiqlash kodini olish uchun quyidagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing yoki saytdagi havoladan kiring:`;

          await TelegramBot.sendMessage(chatId, welcome, {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [
                  {
                    text: '📱 Telefon raqamni yuborish',
                    request_contact: true,
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
        }
      }
    }
  }
}
