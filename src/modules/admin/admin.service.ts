import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Roles, UserStatus } from '../../../generated/prisma/enums';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../db/prisma/prisma.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { username: { contains: s, mode: 'insensitive' } },
        { fullName: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          status: true,
          isVerified: true,
          isPrivate: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: {
            id: true,
            deviceName: true,
            userAgent: true,
            ipAddress: true,
            createdAt: true,
            lastUsedAt: true,
          },
        },
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            collections: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }

  async updateUserStatus(id: string, status: UserStatus, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('O‘zingizning holatingizni o‘zgartira olmaysiz.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    if (user.role === Roles.SUPERADMIN) {
      throw new ForbiddenException('SUPERADMIN holatini o‘zgartirib bo‘lmaydi.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          status,
          deletionScheduledAt:
            status === UserStatus.DELETION_PENDING ? new Date() : null,
        },
        select: {
          id: true,
          username: true,
          status: true,
          role: true,
        },
      });

      // Agar faol emas holatga o'tsa sessiyalarini bekor qilish
      if (status !== UserStatus.ACTIVE) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return u;
    });

    return updated;
  }

  async updateUserRole(id: string, role: Roles, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('O‘zingizning rolingizni o‘zgartira olmaysiz.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        coverUrl: dto.coverUrl,
        isActive: dto.isActive ?? true,
        translations: {
          create: dto.translations.map((t) => ({
            language: t.language,
            name: t.name,
            slug: t.slug,
            description: t.description,
          })),
        },
      },
      include: {
        translations: true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.translations && dto.translations.length > 0) {
        for (const t of dto.translations) {
          await tx.categoryTranslation.upsert({
            where: {
              categoryId_language: {
                categoryId: id,
                language: t.language,
              },
            },
            create: {
              categoryId: id,
              language: t.language,
              name: t.name,
              slug: t.slug,
              description: t.description,
            },
            update: {
              name: t.name,
              slug: t.slug,
              description: t.description,
            },
          });
        }
      }

      return tx.category.update({
        where: { id },
        data: {
          coverUrl: dto.coverUrl,
          isActive: dto.isActive,
        },
        include: {
          translations: true,
        },
      });
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi.');
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { deleted: true };
  }

  async getStats() {
    const [totalUsers, activeUsers, totalPosts, totalPublishedPosts, activeSessions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prisma.post.count(),
        this.prisma.post.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.session.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      posts: {
        total: totalPosts,
        published: totalPublishedPosts,
      },
      sessions: {
        active: activeSessions,
      },
    };
  }
}

