import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../db/prisma/prisma.service';
import { Token } from '../../infrastructure/Token';
import { UserStatus } from '../../../generated/prisma/enums';
import { IPayload } from '../interface/IPayload';

export interface AuthenticatedRequest extends Request {
  user: IPayload;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const bearerToken =
      request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('accessToken='))
      ?.slice('accessToken='.length);

    let cookieToken: string | undefined;

    try {
      cookieToken = cookie ? decodeURIComponent(cookie) : undefined;
    } catch {
      throw new UnauthorizedException('Token noto‘g‘ri.');
    }

    const token = bearerToken ?? cookieToken;

    if (!token) {
      throw new UnauthorizedException('Autentifikatsiya talab qilinadi.');
    }

    const payload = await Token.verifyAccessToken(token);

    if (!payload.id || !payload.sid) {
      throw new UnauthorizedException('Token noto‘g‘ri.');
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!session || session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Sessiya bekor qilingan yoki akkaunt faol emas.',
      );
    }

    request.user = {
      id: session.user.id,
      sid: session.id,
      role: session.user.role,
      status: session.user.status,
    };

    return true;
  }
}
