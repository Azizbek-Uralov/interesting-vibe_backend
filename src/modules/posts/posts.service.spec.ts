import { BadRequestException } from '@nestjs/common';
import { MediaType, PostStatus } from '../../../generated/prisma/enums';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      post: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      postMedia: {
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      postTag: {
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
    };

    service = new PostsService(mockPrisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject adding more than 8 media items to a post', async () => {
    const existingMedia = Array.from({ length: 8 }, (_, i) => ({
      id: `media-${i}`,
      type: MediaType.IMAGE,
      storageKey: `key-${i}`,
      mimeType: 'image/jpeg',
      position: i,
    }));

    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'post-1',
      userId: 'user-1',
      media: existingMedia,
      user: { id: 'user-1', isPrivate: false },
    });

    await expect(
      service.addMedia('user-1', 'post-1', {
        type: MediaType.IMAGE,
        storageKey: 'key-9',
        mimeType: 'image/jpeg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject adding more than 3 videos to a post', async () => {
    const existingMedia = [
      { id: 'v1', type: MediaType.VIDEO, mimeType: 'video/mp4', position: 0 },
      { id: 'v2', type: MediaType.VIDEO, mimeType: 'video/mp4', position: 1 },
      { id: 'v3', type: MediaType.VIDEO, mimeType: 'video/mp4', position: 2 },
    ];

    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'post-1',
      userId: 'user-1',
      media: existingMedia,
      user: { id: 'user-1', isPrivate: false },
    });

    await expect(
      service.addMedia('user-1', 'post-1', {
        type: MediaType.VIDEO,
        storageKey: 'key-v4',
        mimeType: 'video/mp4',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject publishing a post with zero media items', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'post-1',
      userId: 'user-1',
      media: [],
      user: { id: 'user-1', isPrivate: false },
      status: PostStatus.DRAFT,
      tags: [],
      _count: { likes: 0 },
    });

    await expect(
      service.update('user-1', 'post-1', {
        status: PostStatus.PUBLISHED,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

