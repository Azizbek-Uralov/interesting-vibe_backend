import { PostStatus } from '../../../generated/prisma/enums';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let service: LikesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      post: {
        findUnique: jest.fn(),
      },
      like: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      follow: {
        findUnique: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
    };

    service = new LikesService(mockPrisma);
  });

  it('should like a published post and notify the author', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'post-1',
      userId: 'author-1',
      status: PostStatus.PUBLISHED,
      user: { id: 'author-1', isPrivate: false },
    });
    mockPrisma.like.findUnique.mockResolvedValue(null);
    mockPrisma.like.create.mockResolvedValue({ id: 'like-1' });
    mockPrisma.like.count.mockResolvedValue(5);

    const result = await service.like('liker-1', 'post-1');

    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(5);
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });

  it('should unlike a post and return updated count', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' });
    mockPrisma.like.findUnique.mockResolvedValue({ id: 'like-1' });
    mockPrisma.like.delete.mockResolvedValue({ id: 'like-1' });
    mockPrisma.like.count.mockResolvedValue(4);

    const result = await service.unlike('liker-1', 'post-1');

    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(4);
    expect(mockPrisma.like.delete).toHaveBeenCalled();
  });
});

