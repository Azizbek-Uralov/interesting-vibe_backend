import { BadRequestException } from '@nestjs/common';
import { FollowStatus, UserStatus } from '../../../generated/prisma/enums';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  let service: FollowsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      follow: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
    };

    service = new FollowsService(mockPrisma);
  });

  it('should not allow user to follow himself', async () => {
    await expect(service.follow('user-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should create ACCEPTED follow for public target user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      isPrivate: false,
      status: UserStatus.ACTIVE,
    });
    mockPrisma.follow.findUnique.mockResolvedValue(null);
    mockPrisma.follow.create.mockResolvedValue({
      id: 'f-1',
      followerId: 'user-1',
      followingId: 'target-1',
      status: FollowStatus.ACCEPTED,
    });

    const result = await service.follow('user-1', 'target-1');

    expect(result.status).toBe(FollowStatus.ACCEPTED);
    expect(mockPrisma.follow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: FollowStatus.ACCEPTED }),
      }),
    );
  });

  it('should create PENDING follow request for private target user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-private',
      isPrivate: true,
      status: UserStatus.ACTIVE,
    });
    mockPrisma.follow.findUnique.mockResolvedValue(null);
    mockPrisma.follow.create.mockResolvedValue({
      id: 'f-2',
      followerId: 'user-1',
      followingId: 'target-private',
      status: FollowStatus.PENDING,
    });

    const result = await service.follow('user-1', 'target-private');

    expect(result.status).toBe(FollowStatus.PENDING);
    expect(mockPrisma.follow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: FollowStatus.PENDING }),
      }),
    );
  });
});

