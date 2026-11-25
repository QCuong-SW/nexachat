import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRateLimitGuard } from '../../common/guards/user-rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { SendMessageDto } from '../llm/dto/generation-config.dto';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  formatSseEvent,
  type ChatStreamEvent,
} from './types/stream-events.types';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversationsDto,
  ) {
    return this.chatService.listConversations(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createConversation(user.id, dto);
    return { conversation };
  }

  @Get(':id/messages')
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chatService.listMessages(conversationId, user.id, query);
  }

  @Post(':id/messages')
  @UseGuards(UserRateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(conversationId, user.id, dto);
  }

  @Post(':id/messages/stream')
  @UseGuards(UserRateLimitGuard)
  async streamMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    // Kiểm tra ownership & input TRƯỚC khi mở SSE để trả về HTTP 404/400 chuẩn
    const prepared = await this.chatService.prepareStreamTurn(
      conversationId,
      user.id,
      dto,
    );

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    res.on('close', onClose);

    const emit = (event: ChatStreamEvent) => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(formatSseEvent(event));
      }
    };

    try {
      await this.chatService.executeStreamTurn(
        prepared,
        user.id,
        dto,
        emit,
        abortController.signal,
      );
    } finally {
      res.off('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Patch(':id')
  async renameConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    const conversation = await this.chatService.renameConversation(
      conversationId,
      user.id,
      dto,
    );
    return { conversation };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.deleteConversation(conversationId, user.id);
  }
}
