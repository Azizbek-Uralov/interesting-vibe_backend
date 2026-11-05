import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FollowStatus, PostStatus, UserStatus } from '../../../generated/prisma/enums';

const safeProfile = {
  id: true,
  username: true,
  fullName: true,
  bio: true,
  avatarUrl: true,
  preferredLanguage: true,
  isPrivate: true,
  isVerified: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...safeProfile,
        phone: true,
        role: true,
        status: true,
        _count: {
          select: {
            posts: { where: { status: PostStatus.PUBLISHED } },
            followers: { where: { status: FollowStatus.ACCEPTED } },
            following: { where: { status: FollowStatus.ACCEPTED } },
            collections: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi.');

    return {
      ...user,
      postsCount: user._count.posts,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      collectionsCount: user._count.collections,
    };
  }

  async byUsername(username: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...safeProfile,
        status: true,
        _count: {
          select: {
            posts: { where: { status: PostStatus.PUBLISHED } },
            followers: { where: { status: FollowStatus.ACCEPTED } },
            following: { where: { status: FollowStatus.ACCEPTED } },
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    let followStatus: FollowStatus | null = null;
    let isFollowing = false;

    if (viewerId) {
      if (viewerId === user.id) {
        isFollowing = true;
      } else {
        const follow = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: user.id,
            },
          },
          select: { status: true },
        });
        followStatus = follow?.status ?? null;
        isFollowing = followStatus === FollowStatus.ACCEPTED;
      }
    }

    const canViewContent = !user.isPrivate || isFollowing;

    let recentPosts: any[] = [];
    if (canViewContent) {
      const posts = await this.prisma.post.findMany({
        where: {
          userId: user.id,
          status: PostStatus.PUBLISHED,
        },
        take: 30,
        orderBy: { publishedAt: 'desc' },
        include: {
          media: { orderBy: { position: 'asc' } },
          _count: { select: { likes: true } },
          likes: viewerId
            ? {
                where: { userId: viewerId },
                select: { userId: true },
              }
            : false,
        },
      });

      recentPosts = posts.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        publishedAt: p.publishedAt,
        likesCount: p._count.likes,
        isLiked: Array.isArray(p.likes) && p.likes.length > 0,
        media: p.media.map((m: any) => ({
          ...m,
          url: `/api/v1/media/file/${m.storageKey}`,
          fileSize: m.fileSize ? m.fileSize.toString() : null,
        })),
      }));
    }

    const { status: _status, _count, ...publicInfo } = user;

    return {
      ...publicInfo,
      postsCount: _count.posts,
      followersCount: _count.followers,
      followingCount: _count.following,
      isFollowing,
      followStatus,
      canViewContent,
      posts: recentPosts,
    };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: dto,
        select: safeProfile,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu username band.');
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Foydalanuvchi topilmadi.');
      }
      throw error;
    }
  }

  async requestDeletion(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    if (user.status === UserStatus.DELETION_PENDING) {
      return { message: 'Akkauntni o‘chirish jarayoni allaqachon boshlangan.' };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'DELETION_PENDING',
          deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Akkauntni o‘chirish jarayoni boshlandi. 30 kun ichida qayta kirish orqali tiklashingiz mumkin.' };
  }
}
