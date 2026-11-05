import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@ApiCookieAuth('accessToken')
@UseGuards(AccessTokenGuard)
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Joriy foydalanuvchining barcha suhbatlar ro‘yxati' })
  @ApiResponse({ status: 200, description: 'Suhbatlar ro‘yxati qaytarildi.' })
  async getConversations(@Req() req: AuthenticatedRequest) {
    return this.chatService.getUserConversations(req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Foydalanuvchi bilan suhbat boshlash yoki mavjudini olish' })
  @ApiResponse({ status: 200, description: 'Suhbat topildi yoki yangisi yaratildi.' })
  async createOrGetConversation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(req.user.id, dto.participantId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Suhbatdagi xabarlar tarixi (pagination bilan)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Xabarlar ro‘yxati qaytarildi.' })
  async getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getConversationMessages(
      req.user.id,
      conversationId,
      query.page,
      query.limit,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'REST orqali xabar yuborish (WebSocket bilan bir xil ishlaydi)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const result = await this.chatService.saveMessage(
      req.user.id,
      conversationId,
      dto.content,
    );

    // WebSocket orqali barcha ulangan tomonlarga uzatish
    this.chatGateway.emitNewMessage(
      conversationId,
      result.partnerId,
      req.user.id,
      result.message,
    );

    return result.message;
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suhbatdagi kelgan barcha o‘qilmagan xabarlarni o‘qilgan deb belgilash' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.markMessagesAsRead(req.user.id, conversationId);
  }
}
