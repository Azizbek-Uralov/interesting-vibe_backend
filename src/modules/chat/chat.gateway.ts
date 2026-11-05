import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Token } from '../../infrastructure/Token';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Foydalanuvchi ID -> unga tegishli barcha ulangan socket ID lar to‘plami
  private onlineUsers = new Map<string, Set<string>>();

  constructor(private readonly chatService: ChatService) {}

  // 1. WebSocket ulanishini tekshirish va autentifikatsiya
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await Token.verifyAccessToken(token);
      if (!payload?.id) {
        client.disconnect(true);
        return;
      }

      const userId = payload.id;
      client.data.userId = userId;

      // Foydalanuvchini o‘zining shaxsiy roomiga qo‘shish (barcha tablar uchun)
      client.join(`user:${userId}`);

      // Online statusni qayd etish
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      const sockets = this.onlineUsers.get(userId)!;
      sockets.add(client.id);

      // Agar birinchi socketi bo‘lsa, hammaga online ekanligini e’lon qilish
      if (sockets.size === 1) {
        this.server.emit('user_online', { userId });
      }

      // Yangi ulangan clientga hozirgi online userlar ro‘yxatini yuborish
      const allOnlineUserIds = Array.from(this.onlineUsers.keys());
      client.emit('online_users_list', allOnlineUserIds);
    } catch {
      client.disconnect(true);
    }
  }

  // 2. WebSocket uzilishi
  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (!userId) return;

    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.server.emit('user_offline', { userId });
      }
    }
  }

  // 3. Suhbat xonasiga qo‘shilish
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) return;

    const partnerId = await this.chatService.validateParticipant(userId, data.conversationId);
    if (!partnerId) return;

    client.join(`conversation:${data.conversationId}`);
    return { joined: true, conversationId: data.conversationId };
  }

  // 4. Suhbat xonasidan chiqish
  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return;
    client.leave(`conversation:${data.conversationId}`);
    return { left: true, conversationId: data.conversationId };
  }

  // 5. Xabar yuborish
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId || !data?.content) return;

    try {
      const result = await this.chatService.saveMessage(
        userId,
        data.conversationId,
        data.content,
      );

      // Barcha ulangan xonalarga real-time yetkazish
      this.emitNewMessage(
        data.conversationId,
        result.partnerId,
        userId,
        result.message,
      );

      return { success: true, message: result.message };
    } catch (error: any) {
      return { error: error.message || 'Xabar yuborishda xatolik yuz berdi.' };
    }
  }

  // Umumiy xabar tarqatuvchi metod (REST controller va Socket uchun)
  emitNewMessage(
    conversationId: string,
    partnerId: string,
    senderId: string,
    message: any,
  ) {
    if (!this.server) return;
    // 1. Suhbat xonasi
    this.server.to(`conversation:${conversationId}`).emit('new_message', message);
    // 2. Qabul qiluvchining shaxsiy xonasi
    this.server.to(`user:${partnerId}`).emit('new_message', message);
    this.server.to(`user:${partnerId}`).emit('new_message_notification', {
      conversationId,
      message,
    });
    // 3. Yuboruvchining o‘zi (boshqa ochiq tablarida ham ko‘rinishi uchun)
    this.server.to(`user:${senderId}`).emit('new_message', message);
  }

  // 6. Typing status (yozmoqda...)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) return;

    client.to(`conversation:${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId,
    });
  }

  // 7. Stop typing (yozishni to‘xtatdi)
  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) return;

    client.to(`conversation:${data.conversationId}`).emit('user_stop_typing', {
      conversationId: data.conversationId,
      userId,
    });
  }

  // 8. Xabarlarni o‘qilgan deb belgilash
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) return;

    try {
      const result = await this.chatService.markMessagesAsRead(userId, data.conversationId);

      // Suhbatdoshga xabar o‘qilganligi haqida xabar berish
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message_read', {
          conversationId: data.conversationId,
          readerId: userId,
          readAt: result.readAt,
        });

      this.server.to(`user:${result.partnerId}`).emit('message_read', {
        conversationId: data.conversationId,
        readerId: userId,
        readAt: result.readAt,
      });

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // Yordamchi: Handshakedan token olish
  private extractToken(client: Socket): string | null {
    // 1. auth obyekti
    const authHeader = client.handshake.auth?.token;
    if (authHeader) {
      return authHeader.replace(/^Bearer\s+/i, '').trim();
    }

    // 2. headers.authorization
    const header = client.handshake.headers?.authorization;
    if (header) {
      return header.replace(/^Bearer\s+/i, '').trim();
    }

    // 3. query param
    const queryToken =
      (client.handshake.query?.token as string) ||
      (client.handshake.query?.accessToken as string);
    if (queryToken) {
      return queryToken.replace(/^Bearer\s+/i, '').trim();
    }

    // 4. cookie
    const rawCookie = client.handshake.headers?.cookie;
    if (rawCookie) {
      const match = rawCookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('accessToken='));
      if (match) {
        return decodeURIComponent(match.slice('accessToken='.length));
      }
    }

    return null;
  }
}

