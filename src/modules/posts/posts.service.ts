import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus, Language, MediaType, PostStatus } from '../../../generated/prisma/enums';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../db/prisma/prisma.service';
import { AddMediaDto } from './dto/add-media.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query.posts.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const postInclude = {
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
  media: { orderBy: { position: 'asc' as const } },
  tags: {
    include: {
      tag: {
        include: {
          translations: true,
        },
      },
    },
  },
  _count: {
    select: {
      likes: true,
    },
  },
} as const;

type PostWithDetails = Prisma.PostGetPayload<{ include: typeof postInclude }>;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePostDto) {
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);

    const post = await this.prisma.post.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        destinationUrl: dto.destinationUrl,
      },
      include: postInclude,
    });

    if (dto.tags && dto.tags.length > 0) {
      await this.syncTags(post.id, dto.tags);
    }

    return this.findOne(post.id, userId);
  }

  async mine(userId: string) {
    const posts = await this.prisma.post.findMany({
      where: { userId },
      include: postInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return posts.map((post) => this.serialize(post, userId));
  }

  async published(query?: QueryPostsDto, viewerId?: string) {
    const limit = Math.min(Math.max(query?.limit ?? 20, 1), 50);

    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        user: { isPrivate: false },
      },
      include: postInclude,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      ...(query?.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    return posts.map((post) => this.serialize(post, viewerId));
  }

  async findOne(postId: string, viewerId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: postInclude,
    });

    if (!post) throw new NotFoundException('Post topilmadi.');

    if (post.userId === viewerId) {
      return this.serialize(post, viewerId);
    }

    if (post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Post topilmadi.');
    }

    // Yopiq profil tekshiruvi
    if (post.user.isPrivate) {
      if (!viewerId) {
        throw new NotFoundException('Post topilmadi.');
      }

      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: post.userId,
          },
        },
        select: { status: true },
      });

      if (follow?.status !== FollowStatus.ACCEPTED) {
        throw new NotFoundException('Post topilmadi.');
      }
    }

    return this.serialize(post, viewerId);
  }

  async update(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.ownedPost(userId, postId);
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);

    const data: {
      title?: string;
      description?: string;
      categoryId?: string | null;
      destinationUrl?: string | null;
      status?: PostStatus;
      publishedAt?: Date | null;
    } = {
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      destinationUrl: dto.destinationUrl,
    };

    if (dto.status) {
      if (dto.status === PostStatus.PUBLISHED) {
        this.assertPublishable(post.media);
        data.status = PostStatus.PUBLISHED;
        data.publishedAt = post.publishedAt ?? new Date();
      } else if (dto.status === PostStatus.ARCHIVED) {
        data.status = PostStatus.ARCHIVED;
      } else {
        data.status = PostStatus.DRAFT;
        data.publishedAt = null;
      }
    }

    await this.prisma.post.update({
      where: { id: postId },
      data,
    });

    if (dto.tags !== undefined) {
      await this.syncTags(postId, dto.tags);
    }

    return this.findOne(postId, userId);
  }

  async archive(userId: string, postId: string) {
    return this.update(userId, postId, { status: PostStatus.ARCHIVED });
  }

  async remove(userId: string, postId: string) {
    await this.ownedPost(userId, postId);
    await this.prisma.post.delete({ where: { id: postId } });
    return { deleted: true };
  }

  async addMedia(userId: string, postId: string, dto: AddMediaDto) {
    const post = await this.ownedPost(userId, postId);
    this.assertCanAddMedia(post.media, dto.type);
    this.assertMimeType(dto.type, dto.mimeType);

    const media = await this.prisma.postMedia.create({
      data: {
        postId,
        type: dto.type,
        storageKey: dto.storageKey,
        mimeType: dto.mimeType,
        width: dto.width,
        height: dto.height,
        durationSeconds: dto.durationSeconds,
        fileSize: dto.fileSize === undefined ? undefined : BigInt(dto.fileSize),
        position: post.media.length,
      },
    });

    return this.serializeMedia(media);
  }

  async removeMedia(userId: string, postId: string, mediaId: string) {
    const post = await this.ownedPost(userId, postId);
    const media = post.media.find((item) => item.id === mediaId);
    if (!media) throw new NotFoundException('Media topilmadi.');

    if (post.status === PostStatus.PUBLISHED && post.media.length === 1) {
      throw new BadRequestException(
        'PUBLISHED post kamida bitta media faylga ega bo‘lishi kerak.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.postMedia.delete({ where: { id: mediaId } });
      await tx.$executeRaw`
        UPDATE post_media
        SET position = position - 1
        WHERE "postId" = ${postId} AND position > ${media.position}
      `;
    });

    return { deleted: true };
  }

  async reorderMedia(userId: string, postId: string, dto: ReorderMediaDto) {
    const post = await this.ownedPost(userId, postId);
    const existingIds = post.media.map((item) => item.id).sort();
    const requestedIds = [...dto.mediaIds].sort();

    if (
      existingIds.length !== requestedIds.length ||
      existingIds.some((id, index) => id !== requestedIds[index])
    ) {
      throw new BadRequestException(
        'Media tartibi postdagi barcha media IDlarini bir marta o‘z ichiga olishi kerak.',
      );
    }

    await this.prisma.$transaction(
      dto.mediaIds.map((id, position) =>
        this.prisma.postMedia.update({ where: { id }, data: { position } }),
      ),
    );

    return this.findOne(postId, userId);
  }

  private async ownedPost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: postInclude,
    });

    if (!post) throw new NotFoundException('Post topilmadi.');
    if (post.userId !== userId) {
      throw new ForbiddenException('Bu postni boshqarish huquqingiz yo‘q.');
    }

    return post;
  }

  private async ensureCategory(categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Kategoriya mavjud emas yoki faol emas.');
  }

  private assertCanAddMedia(
    media: Array<{ type: MediaType }>,
    nextType: MediaType,
  ) {
    if (media.length >= 8) {
      throw new BadRequestException('Bitta postga ko‘pi bilan 8 ta media qo‘shish mumkin.');
    }
    if (
      nextType === MediaType.VIDEO &&
      media.filter((item) => item.type === MediaType.VIDEO).length >= 3
    ) {
      throw new BadRequestException('Bitta postga ko‘pi bilan 3 ta video qo‘shish mumkin.');
    }
  }

  private assertPublishable(media: Array<{ type: MediaType }>) {
    if (media.length === 0) {
      throw new BadRequestException('Postni e’lon qilish uchun kamida bitta media kerak.');
    }
    if (
      media.length > 8 ||
      media.filter((item) => item.type === MediaType.VIDEO).length > 3
    ) {
      throw new BadRequestException('Post media cheklovlariga mos emas.');
    }
  }

  private assertMimeType(type: MediaType, mimeType: string) {
    const expectedPrefix = type === MediaType.IMAGE ? 'image/' : 'video/';
    if (!mimeType.toLowerCase().startsWith(expectedPrefix)) {
      throw new BadRequestException('Media turi va MIME type mos emas.');
    }
  }

  private async syncTags(postId: string, tagNames: string[]) {
    // Postning eski teglarini tozalash
    await this.prisma.postTag.deleteMany({ where: { postId } });

    const cleanNames = Array.from(
      new Set(tagNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
    );

    for (const name of cleanNames) {
      const slug = name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      let tagTranslation = await this.prisma.tagTranslation.findFirst({
        where: { slug },
        select: { tagId: true },
      });

      let tagId: string;

      if (tagTranslation) {
        tagId = tagTranslation.tagId;
      } else {
        const newTag = await this.prisma.tag.create({
          data: {
            translations: {
              create: [
                {
                  language: Language.UZ,
                  name,
                  slug,
                },
              ],
            },
          },
        });
        tagId = newTag.id;
      }

      await this.prisma.postTag.upsert({
        where: { postId_tagId: { postId, tagId } },
        create: { postId, tagId },
        update: {},
      });
    }
  }

  private serialize(post: PostWithDetails, _viewerId?: string) {
    const { user, media, tags, _count, ...postFields } = post;
    const { isPrivate: _isPrivate, ...author } = user;

    return {
      ...postFields,
      author,
      likesCount: _count?.likes ?? 0,
      tags: (tags ?? []).map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.translations[0]?.name ?? '',
        slug: pt.tag.translations[0]?.slug ?? '',
      })),
      media: media.map((item) => this.serializeMedia(item)),
    };
  }

  private serializeMedia(media: { fileSize: bigint | null; storageKey: string } & Record<string, unknown>) {
    return {
      ...media,
      url: `/api/v1/media/file/${media.storageKey}`,
      fileSize: media.fileSize?.toString() ?? null,
    };
  }
}
