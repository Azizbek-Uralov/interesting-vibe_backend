import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus, NotificationType, PostStatus } from '../../../generated/prisma/enums';
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
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async like(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            isPrivate: true,
          },
        },
      },
    });

    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post topilmadi.');
    }

    // Yopiq profil postiga like berish ruxsatini tekshirish
    if (post.user.isPrivate && post.userId !== userId) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: post.userId,
          },
        },
        select: { status: true },
      });

      if (follow?.status !== FollowStatus.ACCEPTED) {
        throw new NotFoundException('Post topilmadi.');
      }
    }

    // Like mavjudligini tekshirish (idempotent)
    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!existingLike) {
      await this.prisma.like.create({
        data: {
          userId,
          postId,
        },
      });

      // Muallif o'zi bo'lmasa bildirishnoma yaratamiz
      if (post.userId !== userId) {
        await this.prisma.notification.create({
          data: {
            recipientId: post.userId,
            actorId: userId,
            postId,
            type: NotificationType.POST_LIKE,
            message: 'Postingizga like bosdi.',
          },
        });
      }
    }

    const likeCount = await this.prisma.like.count({
      where: { postId },
    });

    return { liked: true, likeCount };
  }

  async unlike(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post topilmadi.');
    }

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingLike) {
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });
    }

    const likeCount = await this.prisma.like.count({
      where: { postId },
    });

    return { liked: false, likeCount };
  }

  async getPostLikes(postId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, likes] = await Promise.all([
      this.prisma.like.count({ where: { postId } }),
      this.prisma.like.findMany({
        where: { postId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: publicUserSelect,
          },
        },
      }),
    ]);

    return {
      data: likes.map((l) => l.user),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

