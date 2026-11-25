import { Injectable } from '@nestjs/common';
import type { Conversation, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface ConversationListResult {
  items: Conversation[];
  nextCursor: string | null;
}

/**
 * MỌI truy vấn hội thoại đều đi qua repository này và BẮT BUỘC lọc
 * `userId` + `deletedAt: null` để tránh quên kiểm tra ownership hoặc soft delete.
 */
@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyForUser(
    userId: string,
    options: { search?: string; limit: number; cursor?: string },
  ): Promise<ConversationListResult> {
    const where: Prisma.ConversationWhereInput = {
      userId,
      deletedAt: null,
      ...(options.search
        ? {
            title: {
              contains: options.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const records = await this.prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
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

  async findByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
    });
  }

  async createForUser(userId: string, title: string): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        userId,
        title,
      },
    });
  }

  async renameForUser(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<Conversation | null> {
    const updated = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      data: { title },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findByIdForUser(conversationId, userId);
  }

  async softDeleteForUser(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const updated = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return updated.count > 0;
  }

  async touchLastMessageAt(
    conversationId: string,
    userId: string,
    at: Date = new Date(),
    newTitle?: string,
  ): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      data: {
        lastMessageAt: at,
        ...(newTitle ? { title: newTitle } : {}),
      },
    });
  }
}
