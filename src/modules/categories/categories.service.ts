import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(language = 'UZ') {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        translations: {
          where: {
            language: language as never,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return categories;
  }

  async findOne(id: string, language = 'UZ') {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        translations: {
          where: {
            language: language as never,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi.');
    }

    return category;
  }
}
