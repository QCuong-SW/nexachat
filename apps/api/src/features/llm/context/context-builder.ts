import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole, MessageStatus, type Message } from '@prisma/client';

// llmproviderinter
import type { LlmMessage } from '../interfaces/llm-provider.interface';

// quy định nội dung đầu ra khi lấy context chat
export interface ContextBuildResult {
  // danh sách tin nhắn được chọn
  messages: LlmMessage[];
  stats: {
    // tổng mess được xem xét
    totalCandidates: number;
    includedCount: number;
    droppedCount: number; // loại
    /** Ước lượng theo số ký tự (~4 ký tự/token) để tiết kiệm quota API countTokens. */
    estimatedChars: number;
    maxHistoryMessages: number;
    maxContextChars: number;
  };
}

export type ContextMessageInput = Pick<Message, 'role' | 'content' | 'status'>;

/**
 * Xây dựng ngữ cảnh hội thoại có giới hạn gửi cho LLM:
 * 1. Chỉ lấy các tin nhắn đã COMPLETED và có nội dung.
 * 2. Cắt theo MAX_HISTORY_MESSAGES (lấy các tin gần nhất).
 * 3. Cắt tiếp theo ngân sách ký tự MAX_CONTEXT_CHARS (loại từ tin cũ nhất).
 * 4. Luôn giữ lại tin nhắn mới nhất của người dùng để model luôn có câu hỏi hiện tại.
 */
@Injectable()
export class ContextBuilder {
  private readonly defaultMaxHistoryMessages: number;
  private readonly defaultMaxContextChars: number;

  constructor(configService: ConfigService) {
    this.defaultMaxHistoryMessages =
      configService.get<number>('chat.maxHistoryMessages') ?? 20;
    this.defaultMaxContextChars =
      configService.get<number>('chat.maxContextChars') ?? 32000;
  }

  build(
    chronologicalMessages: ContextMessageInput[],
    overrides?: { maxHistoryMessages?: number; maxContextChars?: number },
  ): ContextBuildResult {
    const maxHistoryMessages =
      overrides?.maxHistoryMessages ?? this.defaultMaxHistoryMessages;
    const maxContextChars =
      overrides?.maxContextChars ?? this.defaultMaxContextChars;

    const completed = chronologicalMessages.filter(
      (m) => m.status === MessageStatus.COMPLETED && m.content.trim().length > 0,
    );

    const recentSlice =
      completed.length > maxHistoryMessages
        ? completed.slice(-maxHistoryMessages)
        : completed;

    const selectedReverse: LlmMessage[] = [];
    let totalChars = 0;

    for (let i = recentSlice.length - 1; i >= 0; i -= 1) {
      const item = recentSlice[i];
      const text = item.content.trim();
      const isNewest = i === recentSlice.length - 1;

      if (!isNewest && totalChars + text.length > maxContextChars) {
        break;
      }

      selectedReverse.push({
        role: item.role === MessageRole.USER ? 'user' : 'model',
        content: text,
      });
      totalChars += text.length;
    }

    const messages = selectedReverse.reverse();

    // pass check
    return {
      messages,
      stats: {
        totalCandidates: completed.length,
        includedCount: messages.length,
        droppedCount: Math.max(0, completed.length - messages.length),
        estimatedChars: totalChars,
        maxHistoryMessages,
        maxContextChars,
      },
    };
  }
}
