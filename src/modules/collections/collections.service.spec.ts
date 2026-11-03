import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      collection: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      collectionItem: {
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      post: {
        findUnique: jest.fn(),
      },
    };

    service = new CollectionsService(mockPrisma);
  });

  it('should not allow non-owner to access private collection', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue({
      id: 'col-1',
      userId: 'owner-id',
      items: [],
    });

    await expect(service.findOne('another-user', 'col-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should allow owner to access collection', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue({
      id: 'col-1',
      userId: 'owner-id',
      name: 'My Collection',
      items: [],
    });

    const result = await service.findOne('owner-id', 'col-1');
    expect(result.id).toBe('col-1');
    expect(result.name).toBe('My Collection');
  });

  it('should throw NotFoundException if collection does not exist', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    await expect(service.findOne('owner-id', 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

