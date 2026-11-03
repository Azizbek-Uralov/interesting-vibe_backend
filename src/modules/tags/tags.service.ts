import { Injectable } from '@nestjs/common';
import { Language } from '../../../generated/prisma/enums';
import { PrismaService } from '../../db/prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(language?: Language, search?: string, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const tags = await this.prisma.tag.findMany({
      where: search
        ? {
            translations: {
              some: {
                name: { contains: search.trim(), mode: 'insensitive' },
                ...(language ? { language } : {}),
              },
            },
          }
        : undefined,
      take: safeLimit,
      include: {
        translations: language ? { where: { language } } : true,
        _count: {
          select: { posts: true },
        },
      },
      orderBy: {
        posts: { _count: 'desc' },
      },
    });

    return tags.map((t) => ({
      id: t.id,
      postsCount: t._count.posts,
      translations: t.translations,
    }));
  }
}

