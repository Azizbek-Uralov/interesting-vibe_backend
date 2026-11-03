import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus, NotificationType, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../db/prisma/prisma.service';

const publicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  isVerified: true,
  isPrivate: true,
} as const;

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('O‘zingizni kuzata olmaysiz.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, isPrivate: true, status: true },
    });

    if (!targetUser || targetUser.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      if (existingFollow.status === FollowStatus.ACCEPTED) {
        return { message: 'Foydalanuvchini allaqachon kuzatmoqdasiz.', status: existingFollow.status };
      }
      if (existingFollow.status === FollowStatus.PENDING) {
        return { message: 'Kuzatish so‘rovi allaqachon yuborilgan.', status: existingFollow.status };
      }
      // Agar avval rad etilgan bo'lsa, qayta tiklash
      const nextStatus = targetUser.isPrivate ? FollowStatus.PENDING : FollowStatus.ACCEPTED;
      const updated = await this.prisma.follow.update({
        where: { id: existingFollow.id },
        data: { status: nextStatus },
      });

      await this.createFollowNotification(followerId, followingId, nextStatus);

      return {
        message: targetUser.isPrivate
          ? 'Kuzatish so‘rovi yuborildi.'
          : 'Foydalanuvchini kuzatish boshlandi.',
        status: nextStatus,
      };
    }

    const status = targetUser.isPrivate ? FollowStatus.PENDING : FollowStatus.ACCEPTED;

    const follow = await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
        status,
      },
    });

    await this.createFollowNotification(followerId, followingId, status);

    return {
      message: targetUser.isPrivate
        ? 'Kuzatish so‘rovi yuborildi.'
        : 'Foydalanuvchini kuzatish boshlandi.',
      status: follow.status,
    };
  }

  async unfollow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('O‘zingizni kuzatishdan to‘xtata olmaysiz.');
    }

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundException('Kuzatish aloqasi topilmadi.');
    }

    await this.prisma.follow.delete({
      where: { id: follow.id },
    });

    return { message: 'Kuzatish bekor qilindi.' };
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, followers] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: userId, status: FollowStatus.ACCEPTED },
      }),
      this.prisma.follow.findMany({
        where: { followingId: userId, status: FollowStatus.ACCEPTED },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: publicUserSelect,
          },
        },
      }),
    ]);

    return {
      data: followers.map((f) => f.follower),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, following] = await Promise.all([
      this.prisma.follow.count({
        where: { followerId: userId, status: FollowStatus.ACCEPTED },
      }),
      this.prisma.follow.findMany({
        where: { followerId: userId, status: FollowStatus.ACCEPTED },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: publicUserSelect,
          },
        },
      }),
    ]);

    return {
      data: following.map((f) => f.following),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPendingRequests(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, requests] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: userId, status: FollowStatus.PENDING },
      }),
      this.prisma.follow.findMany({
        where: { followingId: userId, status: FollowStatus.PENDING },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: publicUserSelect,
          },
        },
      }),
    ]);

    return {
      data: requests.map((r) => ({
        followId: r.id,
        createdAt: r.createdAt,
        user: r.follower,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async acceptFollowRequest(currentUserId: string, followId: string) {
    const follow = await this.prisma.follow.findFirst({
      where: {
        id: followId,
        followingId: currentUserId,
        status: FollowStatus.PENDING,
      },
      include: {
        following: { select: { username: true } },
      },
    });

    if (!follow) {
      throw new NotFoundException('Kutilayotgan so‘rov topilmadi.');
    }

    await this.prisma.follow.update({
      where: { id: followId },
      data: { status: FollowStatus.ACCEPTED },
    });

    await this.prisma.notification.create({
      data: {
        recipientId: follow.followerId,
        actorId: currentUserId,
        type: NotificationType.FOLLOW_ACCEPTED,
        message: 'Kuzatish so‘rovingiz qabul qilindi.',
      },
    });

    return { message: 'Kuzatish so‘rovi qabul qilindi.' };
  }

  async rejectFollowRequest(currentUserId: string, followId: string) {
    const follow = await this.prisma.follow.findFirst({
      where: {
        id: followId,
        followingId: currentUserId,
        status: FollowStatus.PENDING,
      },
    });

    if (!follow) {
      throw new NotFoundException('Kutilayotgan so‘rov topilmadi.');
    }

    await this.prisma.follow.delete({
      where: { id: followId },
    });

    return { message: 'Kuzatish so‘rovi rad etildi.' };
  }

  async isFollowingAccepted(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) return true;

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
      select: { status: true },
    });

    return follow?.status === FollowStatus.ACCEPTED;
  }

  private async createFollowNotification(
    followerId: string,
    followingId: string,
    status: FollowStatus,
  ) {
    const type =
      status === FollowStatus.PENDING
        ? NotificationType.FOLLOW_REQUEST
        : NotificationType.NEW_FOLLOWER;

    const message =
      status === FollowStatus.PENDING
        ? 'Sizga kuzatish so‘rovi yubordi.'
        : 'Sizni kuzatishni boshladi.';

    await this.prisma.notification.create({
      data: {
        recipientId: followingId,
        actorId: followerId,
        type,
        message,
      },
    });
  }
}

