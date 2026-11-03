import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

import { PrismaService } from '../../db/prisma/prisma.service';
import { RedisService } from '../../db/redis/redis.service';
import { OtpPurpose, UserStatus } from '../../../generated/prisma/enums';
import { Crypt } from '../../infrastructure/Crypt';
import { OtpService } from '../otp/otp.service';
import { Token } from '../../infrastructure/Token';
import { IPayload } from '../../common/interface/IPayload';
import { env } from '../../db';

import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignupDto } from './dto/sign-up.dto';

function durationSeconds(value: string): number {
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);

  if (!match) {
    throw new Error('Token expiry must use s, m, h, or d units');
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return amount * multipliers[unit];
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly redis: RedisService,
  ) {}

  // Client platform
  private isMobile(request: Request): boolean {
    return request.get('X-Client-Platform')?.toLowerCase() === 'mobile';
  }

  // Tokenlarni platformaga mos tarzda yetkazish
  private deliverTokens(
    request: Request,
    response: Response,
    tokens: AuthTokens,
  ) {
    if (this.isMobile(request)) {
      return tokens;
    }

    this.setCookies(response, tokens.accessToken, tokens.refreshToken);
    return undefined;
  }

  // 1. SIGNUP: ma'lumotlarni tekshirish va OTP yuborish
  async signup(dto: SignupDto) {
    const phone = this.otp.normalize(dto.phone);
    const username = dto.username.trim();

    const [existingPhone, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone } }),
      this.prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingPhone) {
      throw new ConflictException('Bu telefon raqami bilan akkaunt mavjud.');
    }

    if (existingUsername) {
      throw new ConflictException('Bu username band.');
    }

    const hashedPassword = await Crypt.hash(dto.password);

    const pendingSignup = {
      phone,
      fullName: dto.fullName.trim(),
      username,
      password: hashedPassword,
    };

    const redisKey = `auth:signup:pending:${phone}`;

    await this.redis.set(redisKey, JSON.stringify(pendingSignup), 300);

    try {
      const delivery = await this.otp.sendOtp(phone, OtpPurpose.SIGN_UP);

      return {
        message:
          delivery.provider === 'TELEGRAM'
            ? 'Iltimos, Telegram bot orqali tasdiqlang.'
            : 'Tasdiqlash kodi yuborildi.',
        ...delivery,
      };
    } catch (error) {
      await this.redis.del(redisKey);
      throw error;
    }
  }

  async getTelegramStatus(sessionToken: string) {
    return this.otp.getTelegramSessionStatus(sessionToken);
  }

  // 2. VERIFY: OTP tekshirish, akkaunt yaratish va tizimga kiritish
  async verifySignup(
    dto: VerifySignupOtpDto,
    request: Request,
    response: Response,
  ) {
    const phone = this.otp.normalize(dto.phone);
    const redisKey = `auth:signup:pending:${phone}`;

    const pendingData = await this.redis.get(redisKey);

    if (!pendingData) {
      throw new BadRequestException(
        'Ro‘yxatdan o‘tish muddati tugagan. Qaytadan signup qiling.',
      );
    }

    const signupData = JSON.parse(pendingData) as {
      phone: string;
      fullName: string;
      username: string;
      password: string;
    };

    await this.otp.verifyOtp(phone, dto.code, OtpPurpose.SIGN_UP);

    let user;

    try {
      user = await this.prisma.user.create({
        data: {
          phone: signupData.phone,
          fullName: signupData.fullName,
          username: signupData.username,
          password: signupData.password,
          isVerified: true,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Telefon raqami yoki username band.');
      }

      throw error;
    }

    await this.redis.del(redisKey);

    const tokens = await this.createSession(
      user.id,
      user.role,
      user.status,
      request,
      response,
    );

    const mobileTokens = this.isMobile(request) ? tokens : undefined;

    return {
      message: 'Akkaunt yaratildi va tizimga kirdingiz.',
      ...(mobileTokens ?? {}),
    };
  }

  // 3. SIGNIN: username + password
  async signin(dto: SignInDto, request: Request, response: Response) {
    const username = dto.username.trim();
    const attemptsKey = `auth:signin:attempts:${username.toLowerCase()}`;

    const attempts = Number((await this.redis.client.get(attemptsKey)) ?? 0);

    if (attempts >= 5) {
      throw new HttpException(
        'Kirish urinishlari vaqtincha cheklangan. Keyinroq urinib ko‘ring.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !(await Crypt.compare(dto.password, user.password))) {
      const count = await this.redis.client.incr(attemptsKey);

      if (count === 1) {
        await this.redis.client.expire(attemptsKey, 15 * 60);
      }

      throw new UnauthorizedException('Username yoki password noto‘g‘ri.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Akkauntdan foydalanish vaqtincha cheklangan.',
      );
    }

    await this.redis.client.del(attemptsKey);

    const tokens = await this.createSession(
      user.id,
      user.role,
      user.status,
      request,
      response,
    );

    return {
      message: 'Tizimga muvaffaqiyatli kirdingiz.',
      ...(this.isMobile(request) ? tokens : {}),
    };
  }

  // 4. REFRESH: cookie (web) yoki body (mobile) orqali tokenni yangilash
  async refresh(
    request: Request,
    response: Response,
    bodyRefreshToken?: string,
  ) {
    const oldToken = this.isMobile(request)
      ? bodyRefreshToken
      : this.cookieValue(request, 'refreshToken');

    if (!oldToken) {
      throw new UnauthorizedException('Refresh token topilmadi.');
    }

    const payload = await Token.verifyRefreshToken(oldToken);

    if (!payload.sid || !payload.id) {
      throw new UnauthorizedException('Refresh token noto‘g‘ri.');
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.id,
        refreshTokenHash: Crypt.hashToken(oldToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Sessiya bekor qilingan yoki muddati tugagan.',
      );
    }

    const accessToken = await Token.generateAccess({
      id: session.user.id,
      sid: session.id,
      role: session.user.role,
      status: session.user.status,
    });

    const refreshToken = await Token.generateRefresh({
      id: session.user.id,
      sid: session.id,
      role: session.user.role,
      status: session.user.status,
    });

    const rotated = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: Crypt.hashToken(oldToken),
        revokedAt: null,
      },
      data: {
        refreshTokenHash: Crypt.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + durationSeconds(env.TOKEN.REFRESH_TIME) * 1000,
        ),
        lastUsedAt: new Date(),
      },
    });

    if (rotated.count !== 1) {
      throw new UnauthorizedException('Refresh token qayta ishlatilgan.');
    }

    const tokens = { accessToken, refreshToken };
    const mobileTokens = this.deliverTokens(request, response, tokens);

    return {
      message: 'Sessiya yangilandi.',
      ...(mobileTokens ?? {}),
    };
  }

  // 5. Joriy sessiyadan chiqish
  async signOut(
    request: Request,
    response: Response,
    bodyRefreshToken?: string,
  ) {
    const refreshToken = this.isMobile(request)
      ? bodyRefreshToken
      : this.cookieValue(request, 'refreshToken');

    if (refreshToken) {
      try {
        const payload = await Token.verifyRefreshToken(refreshToken);

        if (payload.sid) {
          await this.prisma.session.updateMany({
            where: {
              id: payload.sid,
              refreshTokenHash: Crypt.hashToken(refreshToken),
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        }
      } catch {
        // Token yaroqsiz bo‘lsa ham web cookie'lari tozalanadi.
      }
    }

    this.clearCookies(response);

    return { message: 'Tizimdan chiqildi.' };
  }

  // 6. Barcha sessiyalardan chiqish
  async signOutAll(userId: string, response: Response) {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    this.clearCookies(response);

    return { message: 'Barcha sessiyalar bekor qilindi.' };
  }

  // Sessiya yaratish va platformaga mos token yetkazish
  private async createSession(
    userId: string,
    role: IPayload['role'],
    status: IPayload['status'],
    request: Request,
    response: Response,
  ): Promise<AuthTokens> {
    const sid = randomUUID();

    const refreshToken = await Token.generateRefresh({
      id: userId,
      sid,
      role,
      status,
    });

    const accessToken = await Token.generateAccess({
      id: userId,
      sid,
      role,
      status,
    });

    await this.prisma.session.create({
      data: {
        id: sid,
        userId,
        refreshTokenHash: Crypt.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + durationSeconds(env.TOKEN.REFRESH_TIME) * 1000,
        ),
        userAgent: request.get('user-agent')?.slice(0, 500),
        ipAddress: request.ip,
      },
    });

    this.deliverTokens(request, response, { accessToken, refreshToken });

    return { accessToken, refreshToken };
  }

  private setCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    response.cookie('refreshToken', refreshToken, {
      ...authCookieOptions(),
      maxAge: durationSeconds(env.TOKEN.REFRESH_TIME) * 1000,
    });

    response.cookie('accessToken', accessToken, {
      ...authCookieOptions(),
      maxAge: durationSeconds(env.TOKEN.ACCESS_TIME) * 1000,
    });
  }

  private clearCookies(response: Response) {
    response.clearCookie('refreshToken', authCookieOptions());
    response.clearCookie('accessToken', authCookieOptions());
  }

  private cookieValue(request: Request, name: string): string | undefined {
    const entry = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));

    if (!entry) return undefined;

    try {
      return decodeURIComponent(entry.slice(name.length + 1));
    } catch {
      return undefined;
    }
  }
}
