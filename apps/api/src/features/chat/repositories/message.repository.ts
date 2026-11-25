import { Injectable } from '@nestjs/common';
import {
  MessageRole,
  MessageStatus,
  type Message,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface MessageListResult {
  items: Message[];
  nextCursor: string | null;
}

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  finishReason?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export interface UpdateMessageInput {
  content?: string;
  status?: MessageStatus;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  finishReason?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trả về tin nhắn theo thứ tự thời gian tăng dần (cũ -> mới) kèm cursor để phân trang.
   */
  async findByConversation(
    conversationId: string,
    options: { limit: number; cursor?: string },
  ): Promise<MessageListResult> {
    const records = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = records.length > options.limit;
    const items = hasMore ? records.slice(0, options.limit) : records;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  /**
   * Nạp tối đa `limit` tin nhắn COMPLETED gần nhất (trả về theo thứ tự cũ -> mới) cho Context Builder.
   */
  async findRecentCompleted(
    conversationId: string,
    limit: number,
  ): Promise<Message[]> {
    const recentDesc = await this.prisma.message.findMany({
      where: {
        conversationId,
        status: MessageStatus.COMPLETED,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return recentDesc.reverse();
  }

  async countByConversation(conversationId: string): Promise<number> {
    return this.prisma.message.count({
      where: { conversationId },
    });
  }

  async create(input: CreateMessageInput): Promise<Message> {
    return this.prisma.message.create({
      data: input,
    });
  }

  async updateById(id: string, data: UpdateMessageInput): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data,
    });
  }

  async markOrphanPendingAsFailed(): Promise<number> {
    const res = await this.prisma.message.updateMany({
      where: { status: MessageStatus.PENDING },
      data: {
        status: MessageStatus.FAILED,
        finishReason: 'SERVER_INTERRUPTED',
      },
    });
    return res.count;
  }
}
