import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      notification: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new NotificationsService(mockPrisma);
  });

  it('should return notifications list with unreadCount', async () => {
    mockPrisma.notification.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1); // unreadCount

    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'notif-1',
        type: 'POST_LIKE',
        message: 'Like bosdi',
        readAt: null,
        createdAt: new Date(),
        actor: { id: 'actor-1', username: 'actor' },
        post: { id: 'post-1', title: 'Post', media: [] },
      },
    ]);

    const result = await service.findAll('user-1', 1, 20);

    expect(result.data.length).toBe(1);
    expect(result.meta.unreadCount).toBe(1);
  });

  it('should mark all notifications as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

    const result = await service.markAllAsRead('user-1');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(5);
  });
});

