import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageRole,
  MessageStatus,
  type Conversation,
  type Message,
} from '@prisma/client';
import { ContextBuilder } from '../llm/context/context-builder';
import type { SendMessageDto } from '../llm/dto/generation-config.dto';
import {
  LlmProviderError,
  mapGeminiError,
} from '../llm/errors/llm-provider.error';
import type { LlmUsage } from '../llm/interfaces/llm-provider.interface';
import { LlmService } from '../llm/llm.service';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { ListConversationsDto } from './dto/list-conversations.dto';
import type { ListMessagesDto } from './dto/list-messages.dto';
import type { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  ConversationRepository,
  type ConversationListResult,
} from './repositories/conversation.repository';
import {
  MessageRepository,
  type MessageListResult,
} from './repositories/message.repository';
import type { ChatStreamEvent } from './types/stream-events.types';
import { generateDeterministicTitle } from './utils/title-generator';

export const DEFAULT_CONVERSATION_TITLE = 'Cuộc trò chuyện mới';

export interface PreparedStreamTurn {
  conversation: Conversation;
  content: string;
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private readonly maxHistoryMessages: number;
  private readonly maxInputChars: number;

  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly llmService: LlmService,
    private readonly contextBuilder: ContextBuilder,
    configService: ConfigService,
  ) {
    this.maxHistoryMessages =
      configService.get<number>('chat.maxHistoryMessages') ?? 20;
    this.maxInputChars = configService.get<number>('chat.maxInputChars') ?? 8000;
  }

  /**
   * Dọn dẹp các message PENDING bị bỏ lại nếu server từng crash giữa chừng khi đang stream.
   */
  async onModuleInit(): Promise<void> {
    try {
      const cleaned = await this.messageRepo.markOrphanPendingAsFailed();
      if (cleaned > 0) {
        this.logger.warn(
          `Marked ${cleaned} orphaned PENDING assistant message(s) as FAILED on startup.`,
        );
      }
    } catch {
      // Bỏ qua trong môi trường test hoặc khi chưa kết nối DB
    }
  }

  async listConversations(
    userId: string,
    query: ListConversationsDto,
  ): Promise<ConversationListResult> {
    return this.conversationRepo.findManyForUser(userId, {
      search: query.search,
      limit: query.limit ?? 30,
      cursor: query.cursor,
    });
  }

  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<Conversation> {
    const title = dto.title?.trim() || DEFAULT_CONVERSATION_TITLE;
    return this.conversationRepo.createForUser(userId, title);
  }

  async getConversationOrThrow(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.findByIdForUser(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found.',
      });
    }
    return conversation;
  }

  async listMessages(
    conversationId: string,
    userId: string,
    query: ListMessagesDto,
  ): Promise<MessageListResult & { conversation: Conversation }> {
    const conversation = await this.getConversationOrThrow(
      conversationId,
      userId,
    );
    const messages = await this.messageRepo.findByConversation(conversationId, {
      limit: query.limit ?? 50,
      cursor: query.cursor,
    });

    return {
      conversation,
      ...messages,
    };
  }

  async renameConversation(
    conversationId: string,
    userId: string,
    dto: UpdateConversationDto,
  ): Promise<Conversation> {
    const updated = await this.conversationRepo.renameForUser(
      conversationId,
      userId,
      dto.title.trim(),
    );

    if (!updated) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found.',
      });
    }

    return updated;
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const deleted = await this.conversationRepo.softDeleteForUser(
      conversationId,
      userId,
    );

    if (!deleted) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found.',
      });
    }

    return { success: true };
  }

  /**
   * Kiểm tra quyền sở hữu và độ dài tin nhắn TRƯỚC khi mở kết nối SSE,
   * để các lỗi 404/400 trả về HTTP JSON chuẩn.
   */
  async prepareStreamTurn(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<PreparedStreamTurn> {
    const conversation = await this.getConversationOrThrow(
      conversationId,
      userId,
    );
    const content = dto.content.trim();
    if (content.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_MESSAGE',
        message: 'Message content cannot be empty.',
      });
    }
    if (content.length > this.maxInputChars) {
      throw new BadRequestException({
        code: 'MESSAGE_TOO_LONG',
        message: `Message exceeds maximum length of ${this.maxInputChars} characters.`,
      });
    }

    return { conversation, content };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const { conversation, content } = await this.prepareStreamTurn(
      conversationId,
      userId,
      dto,
    );

    const existingCount =
      await this.messageRepo.countByConversation(conversationId);

    const userMessage = await this.messageRepo.create({
      conversationId,
      role: MessageRole.USER,
      content,
      status: MessageStatus.COMPLETED,
    });

    const deterministicTitle =
      existingCount === 0 && conversation.title === DEFAULT_CONVERSATION_TITLE
        ? generateDeterministicTitle(content)
        : undefined;

    await this.conversationRepo.touchLastMessageAt(
      conversationId,
      userId,
      userMessage.createdAt,
      deterministicTitle,
    );

    const recentMessages = await this.messageRepo.findRecentCompleted(
      conversationId,
      this.maxHistoryMessages,
    );
    const context = this.contextBuilder.build(recentMessages);

    const pendingAssistant = await this.messageRepo.create({
      conversationId,
      role: MessageRole.ASSISTANT,
      content: '',
      status: MessageStatus.PENDING,
      model: this.llmService.getModelId(),
    });

    const startedAt = Date.now();
    try {
      const reply = await this.llmService.generateChatReply(
        context.messages,
        dto.config,
      );

      const assistantMessage = await this.messageRepo.updateById(
        pendingAssistant.id,
        {
          content: reply.content,
          status: MessageStatus.COMPLETED,
          model: reply.model,
          inputTokens: reply.usage.inputTokens,
          outputTokens: reply.usage.outputTokens,
          finishReason: reply.finishReason,
          metadata: {
            durationMs: reply.durationMs,
            contextMessagesUsed: context.stats.includedCount,
          },
        },
      );

      await this.conversationRepo.touchLastMessageAt(
        conversationId,
        userId,
        new Date(),
      );

      return { userMessage, assistantMessage };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorCode =
        error instanceof LlmProviderError ? error.errorCode : 'LLM_UNAVAILABLE';

      await this.messageRepo.updateById(pendingAssistant.id, {
        status: MessageStatus.FAILED,
        finishReason: errorCode,
        metadata: {
          durationMs,
          errorCode,
        },
      });

      throw error;
    }
  }

  /**
   * Stage 5: Luồng streaming SSE theo đúng vòng đời:
   * message.started -> message.delta* -> message.completed | message.error
   * Nếu client ngắt kết nối (AbortSignal) -> lưu CANCELLED (giữ phần text đã nhận).
   */
  async executeStreamTurn(
    prepared: PreparedStreamTurn,
    userId: string,
    dto: SendMessageDto,
    emit: (event: ChatStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const { conversation, content } = prepared;
    const conversationId = conversation.id;

    const existingCount =
      await this.messageRepo.countByConversation(conversationId);

    const userMessage = await this.messageRepo.create({
      conversationId,
      role: MessageRole.USER,
      content,
      status: MessageStatus.COMPLETED,
    });

    const deterministicTitle =
      existingCount === 0 && conversation.title === DEFAULT_CONVERSATION_TITLE
        ? generateDeterministicTitle(content)
        : undefined;

    await this.conversationRepo.touchLastMessageAt(
      conversationId,
      userId,
      userMessage.createdAt,
      deterministicTitle,
    );

    const recentMessages = await this.messageRepo.findRecentCompleted(
      conversationId,
      this.maxHistoryMessages,
    );
    const context = this.contextBuilder.build(recentMessages);

    const modelId = this.llmService.getModelId();
    const pendingAssistant = await this.messageRepo.create({
      conversationId,
      role: MessageRole.ASSISTANT,
      content: '',
      status: MessageStatus.PENDING,
      model: modelId,
    });

    emit({
      event: 'message.started',
      data: {
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: pendingAssistant.id,
        model: modelId,
        ...(deterministicTitle ? { conversationTitle: deterministicTitle } : {}),
      },
    });

    const startedAt = Date.now();
    let accumulated = '';
    let finalUsage: LlmUsage = { inputTokens: null, outputTokens: null };
    let finalFinishReason: string | null = null;

    try {
      const stream = this.llmService.streamChatReply(
        context.messages,
        dto.config,
        signal,
      );

      for await (const chunk of stream) {
        if (signal.aborted) {
          break;
        }

        if (chunk.type === 'delta' && chunk.delta) {
          accumulated += chunk.delta;
          emit({
            event: 'message.delta',
            data: {
              assistantMessageId: pendingAssistant.id,
              delta: chunk.delta,
            },
          });
        } else if (chunk.type === 'done') {
          if (chunk.usage) finalUsage = chunk.usage;
          if (chunk.finishReason !== undefined) {
            finalFinishReason = chunk.finishReason;
          }
        }
      }

      const durationMs = Date.now() - startedAt;

      if (signal.aborted) {
        // Không bao giờ đánh dấu tin nhắn bị huỷ giữa chừng là COMPLETED
        await this.messageRepo.updateById(pendingAssistant.id, {
          content: accumulated,
          status: MessageStatus.CANCELLED,
          model: modelId,
          inputTokens: finalUsage.inputTokens,
          outputTokens: finalUsage.outputTokens,
          finishReason: 'USER_CANCELLED',
          metadata: {
            durationMs,
            contextMessagesUsed: context.stats.includedCount,
          },
        });
        await this.conversationRepo.touchLastMessageAt(
          conversationId,
          userId,
          new Date(),
        );
        return;
      }

      await this.messageRepo.updateById(pendingAssistant.id, {
        content: accumulated,
        status: MessageStatus.COMPLETED,
        model: modelId,
        inputTokens: finalUsage.inputTokens,
        outputTokens: finalUsage.outputTokens,
        finishReason: finalFinishReason ?? 'STOP',
        metadata: {
          durationMs,
          contextMessagesUsed: context.stats.includedCount,
        },
      });

      await this.conversationRepo.touchLastMessageAt(
        conversationId,
        userId,
        new Date(),
      );

      emit({
        event: 'message.completed',
        data: {
          assistantMessageId: pendingAssistant.id,
          content: accumulated,
          model: modelId,
          inputTokens: finalUsage.inputTokens,
          outputTokens: finalUsage.outputTokens,
          finishReason: finalFinishReason ?? 'STOP',
          durationMs,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const mapped = mapGeminiError(error);

      if (signal.aborted || mapped.errorCode === 'LLM_CANCELLED') {
        await this.messageRepo.updateById(pendingAssistant.id, {
          content: accumulated,
          status: MessageStatus.CANCELLED,
          model: modelId,
          finishReason: 'USER_CANCELLED',
          metadata: { durationMs },
        });
        return;
      }

      await this.messageRepo.updateById(pendingAssistant.id, {
        content: accumulated,
        status: MessageStatus.FAILED,
        model: modelId,
        finishReason: mapped.errorCode,
        metadata: {
          durationMs,
          errorCode: mapped.errorCode,
        },
      });

      const payload = mapped.getResponse() as { message?: string };
      emit({
        event: 'message.error',
        data: {
          assistantMessageId: pendingAssistant.id,
          code: mapped.errorCode,
          message:
            payload?.message ??
            'Không thể hoàn tất phản hồi từ mô hình AI. Vui lòng thử lại.',
        },
      });
    }
  }
}
