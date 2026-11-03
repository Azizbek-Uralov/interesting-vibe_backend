import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';

const actorSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  isVerified: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit;

    const whereClause: {
      recipientId: string;
      readAt?: null;
    } = {
      recipientId: userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [total, unreadCount, notifications] = await Promise.all([
      this.prisma.notification.count({ where: whereClause }),
      this.prisma.notification.count({
        where: { recipientId: userId, readAt: null },
      }),
      this.prisma.notification.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: actorSelect,
          },
          post: {
            select: {
              id: true,
              title: true,
              media: {
                take: 1,
                orderBy: { position: 'asc' },
                select: {
                  storageKey: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        readAt: n.readAt,
        createdAt: n.createdAt,
        actor: n.actor,
        post: n.post
          ? {
              id: n.post.id,
              title: n.post.title,
              thumbnailUrl: n.post.media[0]
                ? `/api/v1/media/file/${n.post.media[0].storageKey}`
                : null,
            }
          : null,
      })),
      meta: {
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Bildirishnoma topilmadi.');
    }

    if (!notification.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }

    return { success: true };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { success: true, updatedCount: result.count };
  }

  async remove(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Bildirishnoma topilmadi.');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { deleted: true };
  }
}

