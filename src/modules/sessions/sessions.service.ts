import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../db/prisma/prisma.service';
import { SessionResponseDto } from './dto/session-response.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Userning faol sessiyalarini olish
  async findAll(userId: string): Promise<SessionResponseDto[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });
  }

  // Bitta sessiyani bekor qilish
  async revoke(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      message: 'Session revoked successfully',
    };
  }

  // Barcha sessiyalarni bekor qilish
  async revokeAll(
    userId: string,
    currentSessionId: string,
  ): Promise<{ message: string; count: number }> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        id: {
          not: currentSessionId,
        },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      message: 'All other sessions revoked successfully',
      count: result.count,
    };
  }
}