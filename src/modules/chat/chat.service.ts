import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../db/prisma/prisma.service';

const userPublicSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  isVerified: true,
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Foydalanuvchining barcha suhbatlari
  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ userOneId: userId }, { userTwoId: userId }],
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      include: {
        userOne: { select: userPublicSelect },
        userTwo: { select: userPublicSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            senderId: true,
            content: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
    });

    // Har bir suhbat uchun unreadCount hisoblash
    const conversationIds = conversations.map((c) => c.id);

    // O'qilmagan xabarlar soni
    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        isRead: false,
      },
      _count: {
        id: true,
      },
    });

    const unreadMap = new Map<string, number>();
    for (const item of unreadCounts) {
      unreadMap.set(item.conversationId, item._count.id);
    }

    return conversations.map((c) => {
      const partner = c.userOneId === userId ? c.userTwo : c.userOne;
      const lastMessage = c.messages[0] || null;
      const unreadCount = unreadMap.get(c.id) || 0;

      return {
        id: c.id,
        partner,
        lastMessage,
        unreadCount,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });
  }

  // 2. Yangi suhbat boshlash yoki mavjudini olish
  async getOrCreateConversation(userId: string, participantId: string) {
    if (userId === participantId) {
      throw new BadRequestException('O‘zingiz bilan suhbat o‘rnatib bo‘lmaydi.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: participantId },
      select: userPublicSelect,
    });

    if (!targetUser) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    // 1:1 suhbatlar uchun har doim userOneId < userTwoId qilib tartiblaymiz
    const [userOneId, userTwoId] =
      userId < participantId ? [userId, participantId] : [participantId, userId];

    let conversation = await this.prisma.conversation.findUnique({
      where: {
        userOneId_userTwoId: {
          userOneId,
          userTwoId,
        },
      },
      include: {
        userOne: { select: userPublicSelect },
        userTwo: { select: userPublicSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userOneId,
          userTwoId,
        },
        include: {
          userOne: { select: userPublicSelect },
          userTwo: { select: userPublicSelect },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    }

    const partner = conversation.userOneId === userId ? conversation.userTwo : conversation.userOne;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        isRead: false,
      },
    });

    return {
      id: conversation.id,
      partner,
      lastMessage: conversation.messages[0] || null,
      unreadCount,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  // 3. Suhbat xabarlar tarixi
  async getConversationMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 30,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Suhbat topilmadi.');
    }

    if (conversation.userOneId !== userId && conversation.userTwoId !== userId) {
      throw new ForbiddenException('Ushbu suhbatga kirish huquqiga ega emassiz.');
    }

    const skip = (page - 1) * limit;

    const [total, messages] = await Promise.all([
      this.prisma.message.count({
        where: { conversationId },
      }),
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: userPublicSelect,
          },
        },
      }),
    ]);

    // Xronologik tartib (eski xabardan yangisiga)
    const chronologicalMessages = [...messages].reverse();

    return {
      data: chronologicalMessages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + messages.length < total,
    };
  }

  // 4. Xabarlarni o‘qilgan deb belgilash
  async markMessagesAsRead(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Suhbat topilmadi.');
    }

    if (conversation.userOneId !== userId && conversation.userTwoId !== userId) {
      throw new ForbiddenException('Ushbu suhbatga kirish huquqiga ega emassiz.');
    }

    const now = new Date();
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    const partnerId = conversation.userOneId === userId ? conversation.userTwoId : conversation.userOneId;

    return {
      success: true,
      updatedCount: result.count,
      conversationId,
      partnerId,
      readAt: now,
    };
  }

  // 5. Xabar saqlash (REST yoki WebSocket orqali)
  async saveMessage(senderId: string, conversationId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('Xabar bo‘sh bo‘lishi mumkin emas.');
    }

    if (trimmed.length > 3000) {
      throw new BadRequestException('Xabar uzunligi 3000 belgidan oshmasligi kerak.');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Suhbat topilmadi.');
    }

    if (conversation.userOneId !== senderId && conversation.userTwoId !== senderId) {
      throw new ForbiddenException('Ushbu suhbatga xabar yozish huquqiga ega emassiz.');
    }

    const now = new Date();

    const [message] = await Promise.all([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          content: trimmed,
          isRead: false,
          createdAt: now,
          updatedAt: now,
        },
        include: {
          sender: {
            select: userPublicSelect,
          },
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
        },
      }),
    ]);

    const partnerId =
      conversation.userOneId === senderId ? conversation.userTwoId : conversation.userOneId;

    return {
      message,
      partnerId,
    };
  }

  // Yordamchi: Foydalanuvchining conversation ishtirokchisi ekanligini tekshirish
  async validateParticipant(userId: string, conversationId: string): Promise<string | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userOneId: true, userTwoId: true },
    });

    if (!conversation) return null;
    if (conversation.userOneId !== userId && conversation.userTwoId !== userId) {
      return null;
    }

    return conversation.userOneId === userId ? conversation.userTwoId : conversation.userOneId;
  }
}

