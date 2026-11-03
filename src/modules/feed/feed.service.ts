import { Injectable } from '@nestjs/common';
import { FollowStatus, PostStatus, UserStatus } from '../../../generated/prisma/enums';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../db/prisma/prisma.service';
import { FeedQueryDto, FeedType } from './dto/feed-query.dto';

const feedPostInclude = {
  user: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      isVerified: true,
      isPrivate: true,
    },
  },
  media: {
    orderBy: { position: 'asc' as const },
  },
  _count: {
    select: {
      likes: true,
    },
  },
} as const;

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(query: FeedQueryDto, viewerId?: string) {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const skip = (page - 1) * limit;

    let followingIds: string[] = [];

    if (viewerId) {
      const followings = await this.prisma.follow.findMany({
        where: {
          followerId: viewerId,
          status: FollowStatus.ACCEPTED,
        },
        select: { followingId: true },
      });
      followingIds = followings.map((f) => f.followingId);
    }

    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      user: {
        status: UserStatus.ACTIVE,
      },
    };

    if (query.type === FeedType.FOLLOWING) {
      if (!viewerId || followingIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      where.userId = { in: followingIds };
    } else {
      // FeedType.ALL
      if (viewerId) {
        where.OR = [
          { user: { isPrivate: false } },
          { userId: { in: followingIds } },
          { userId: viewerId },
        ];
      } else {
        where.user = {
          isPrivate: false,
          status: UserStatus.ACTIVE,
        };
      }
    }

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          ...feedPostInclude,
          likes: viewerId
            ? {
                where: { userId: viewerId },
                select: { id: true },
              }
            : false,
        },
      }),
    ]);

    const formattedPosts = posts.map((post) => {
      const { user, media, _count, likes, ...fields } = post as any;
      return {
        ...fields,
        author: user,
        likesCount: _count.likes,
        isLiked: Array.isArray(likes) && likes.length > 0,
        media: media.map((m: any) => ({
          ...m,
          url: `/api/v1/media/file/${m.storageKey}`,
          fileSize: m.fileSize ? m.fileSize.toString() : null,
        })),
      };
    });

    return {
      data: formattedPosts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

