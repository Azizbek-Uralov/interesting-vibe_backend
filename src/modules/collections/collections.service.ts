import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCollectionDto) {
    return this.prisma.collection.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        coverUrl: dto.coverUrl,
      },
      select: {
        id: true,
        name: true,
        description: true,
        coverUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(userId: string) {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return collections.map((col) => ({
      id: col.id,
      name: col.name,
      description: col.description,
      coverUrl: col.coverUrl,
      itemsCount: col._count.items,
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
    }));
  }

  async findOne(userId: string, collectionId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            post: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                    avatarUrl: true,
                    isVerified: true,
                  },
                },
                media: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Kolleksiya topilmadi.');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('Bu kolleksiyani ko‘rish huquqingiz yo‘q.');
    }

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      coverUrl: collection.coverUrl,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      items: collection.items.map((item) => ({
        id: item.id,
        position: item.position,
        addedAt: item.createdAt,
        post: {
          ...item.post,
          media: item.post.media.map((m) => ({
            ...m,
            fileSize: m.fileSize ? m.fileSize.toString() : null,
          })),
        },
      })),
    };
  }

  async update(userId: string, collectionId: string, dto: UpdateCollectionDto) {
    await this.assertOwnership(userId, collectionId);

    return this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        name: dto.name,
        description: dto.description,
        coverUrl: dto.coverUrl,
      },
      select: {
        id: true,
        name: true,
        description: true,
        coverUrl: true,
        updatedAt: true,
      },
    });
  }

  async remove(userId: string, collectionId: string) {
    await this.assertOwnership(userId, collectionId);

    await this.prisma.collection.delete({
      where: { id: collectionId },
    });

    return { deleted: true };
  }

  async addPost(userId: string, collectionId: string, postId: string) {
    const collection = await this.assertOwnership(userId, collectionId);

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post topilmadi.');
    }

    const existingItem = await this.prisma.collectionItem.findUnique({
      where: {
        collectionId_postId: {
          collectionId,
          postId,
        },
      },
    });

    if (existingItem) {
      return { message: 'Post allaqachon kolleksiyada mavjud.' };
    }

    const count = await this.prisma.collectionItem.count({
      where: { collectionId },
    });

    await this.prisma.collectionItem.create({
      data: {
        collectionId,
        postId,
        position: count,
      },
    });

    return { message: 'Post kolleksiyaga qo‘shildi.' };
  }

  async removePost(userId: string, collectionId: string, postId: string) {
    await this.assertOwnership(userId, collectionId);

    const item = await this.prisma.collectionItem.findUnique({
      where: {
        collectionId_postId: {
          collectionId,
          postId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Post kolleksiyada topilmadi.');
    }

    await this.prisma.collectionItem.delete({
      where: { id: item.id },
    });

    return { message: 'Post kolleksiyadan olib tashlandi.' };
  }

  private async assertOwnership(userId: string, collectionId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      select: { id: true, userId: true },
    });

    if (!collection) {
      throw new NotFoundException('Kolleksiya topilmadi.');
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('Bu kolleksiyani boshqarish huquqingiz yo‘q.');
    }

    return collection;
  }
}

