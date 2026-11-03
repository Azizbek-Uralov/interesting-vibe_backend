import { Injectable } from '@nestjs/common';
import { FollowStatus, PostStatus, UserStatus } from '../../../generated/prisma/enums';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../db/prisma/prisma.service';
import { SearchQueryDto, SearchType } from './dto/search-query.dto';

const publicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  isVerified: true,
  isPrivate: true,
} as const;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto, viewerId?: string) {
    const q = query.q.trim();
    const type = query.type ?? SearchType.ALL;
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const skip = (page - 1) * limit;

    const result: {
      posts?: any;
      users?: any;
      tags?: any;
    } = {};

    let followingIds: string[] = [];
    if (viewerId) {
      const followings = await this.prisma.follow.findMany({
        where: { followerId: viewerId, status: FollowStatus.ACCEPTED },
        select: { followingId: true },
      });
      followingIds = followings.map((f) => f.followingId);
    }

    if (type === SearchType.POSTS || type === SearchType.ALL) {
      const postWhere: Prisma.PostWhereInput = {
        status: PostStatus.PUBLISHED,
        user: { status: UserStatus.ACTIVE },
        AND: [
          viewerId
            ? {
                OR: [
                  { user: { isPrivate: false } },
                  { userId: { in: followingIds } },
                  { userId: viewerId },
                ],
              }
            : { user: { isPrivate: false } },
          {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              {
                tags: {
                  some: {
                    tag: {
                      translations: {
                        some: {
                          name: { contains: q, mode: 'insensitive' },
                        },
                      },
                    },
                  },
                },
              },
              {
                category: {
                  translations: {
                    some: {
                      name: { contains: q, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          },
        ],
      };

      const [postTotal, posts] = await Promise.all([
        this.prisma.post.count({ where: postWhere }),
        this.prisma.post.findMany({
          where: postWhere,
          skip: type === SearchType.POSTS ? skip : 0,
          take: type === SearchType.POSTS ? limit : 10,
          orderBy: { publishedAt: 'desc' },
          include: {
            user: { select: publicUserSelect },
            media: { orderBy: { position: 'asc' } },
            _count: { select: { likes: true } },
          },
        }),
      ]);

      result.posts = {
        data: posts.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          status: p.status,
          publishedAt: p.publishedAt,
          author: p.user,
          likesCount: p._count.likes,
          media: p.media.map((m) => ({
            ...m,
            url: `/api/v1/media/file/${m.storageKey}`,
            fileSize: m.fileSize ? m.fileSize.toString() : null,
          })),
        })),
        total: postTotal,
      };
    }

    if (type === SearchType.USERS || type === SearchType.ALL) {
      const userWhere: Prisma.UserWhereInput = {
        status: UserStatus.ACTIVE,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      };

      const [userTotal, users] = await Promise.all([
        this.prisma.user.count({ where: userWhere }),
        this.prisma.user.findMany({
          where: userWhere,
          skip: type === SearchType.USERS ? skip : 0,
          take: type === SearchType.USERS ? limit : 10,
          select: publicUserSelect,
        }),
      ]);

      result.users = {
        data: users,
        total: userTotal,
      };
    }

    if (type === SearchType.TAGS || type === SearchType.ALL) {
      const tagWhere: Prisma.TagWhereInput = {
        translations: {
          some: {
            name: { contains: q, mode: 'insensitive' },
          },
        },
      };

      const [tagTotal, tags] = await Promise.all([
        this.prisma.tag.count({ where: tagWhere }),
        this.prisma.tag.findMany({
          where: tagWhere,
          skip: type === SearchType.TAGS ? skip : 0,
          take: type === SearchType.TAGS ? limit : 10,
          include: {
            translations: true,
            _count: { select: { posts: true } },
          },
        }),
      ]);

      result.tags = {
        data: tags.map((t) => ({
          id: t.id,
          postsCount: t._count.posts,
          translations: t.translations,
        })),
        total: tagTotal,
      };
    }

    return {
      query: q,
      type,
      ...result,
      meta: {
        page,
        limit,
      },
    };
  }
}

