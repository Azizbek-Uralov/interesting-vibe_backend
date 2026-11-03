import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    service = new ChatService(mockPrisma);
  });

  describe('getOrCreateConversation', () => {
    it('o‘zi bilan suhbat ochmoqchi bo‘lsa BadRequestException qaytarishi kerak', async () => {
      await expect(
        service.getOrCreateConversation('user-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('suhbatdosh mavjud bo‘lmasa NotFoundException qaytarishi kerak', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrCreateConversation('user-1', 'user-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('oldin mavjud suhbat bo‘lsa o‘shani qaytarishi kerak', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', username: 'user2' });
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-123',
        userOneId: 'user-1',
        userTwoId: 'user-2',
        userOne: { id: 'user-1', username: 'user1' },
        userTwo: { id: 'user-2', username: 'user2' },
        messages: [],
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.message.count.mockResolvedValue(0);

      const result = await service.getOrCreateConversation('user-1', 'user-2');
      expect(result.id).toBe('conv-123');
      expect(result.partner.id).toBe('user-2');
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  describe('getConversationMessages', () => {
    it('begona user xabarlarni o‘qimoqchi bo‘lsa ForbiddenException qaytarishi kerak', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-123',
        userOneId: 'user-1',
        userTwoId: 'user-2',
      });

      await expect(
        service.getConversationMessages('user-intruder', 'conv-123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('saveMessage', () => {
    it('bo‘sh xabar yuborilganda BadRequestException qaytarishi kerak', async () => {
      await expect(
        service.saveMessage('user-1', 'conv-123', '   '),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

