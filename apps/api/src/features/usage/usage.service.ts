import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole, MessageStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface UserUsageSummary {
  model: string;
  modelDisplayName: string;
  freeTierNotice: string;
  totals: {
    assistantMessages: number;
    completedMessages: number;
    failedMessages: number;
    cancelledMessages: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    messagesWithTokenData: number;
    averageDurationMs: number | null;
  };
}

@Injectable()
export class UsageService {
  private readonly model: string;
  private readonly modelDisplayName: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.model =
      configService.get<string>('gemini.model') ?? 'gemini-3.5-flash-lite';
    this.modelDisplayName =
      configService.get<string>('gemini.modelDisplayName') ??
      'Gemini 3.5 Flash-Lite — Free Tier';
  }

  /**
   * Tổng hợp thống kê token & độ trễ của riêng người dùng hiện tại.
   * KHÔNG tự bịa số token khi provider không trả về (chỉ cộng các bản ghi có dữ liệu thật).
   */
  async getUserUsage(userId: string): Promise<UserUsageSummary> {
    const assistantMessages = await this.prisma.message.findMany({
      where: {
        role: MessageRole.ASSISTANT,
        conversation: {
          userId,
          deletedAt: null,
        },
      },
      select: {
        status: true,
        inputTokens: true,
        outputTokens: true,
        metadata: true,
      },
    });

    let completedMessages = 0;
    let failedMessages = 0;
    let cancelledMessages = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let messagesWithTokenData = 0;
    let durationSum = 0;
    let durationCount = 0;

    for (const msg of assistantMessages) {
      if (msg.status === MessageStatus.COMPLETED) completedMessages += 1;
      else if (msg.status === MessageStatus.FAILED) failedMessages += 1;
      else if (msg.status === MessageStatus.CANCELLED) cancelledMessages += 1;

      const hasTokenInfo =
        typeof msg.inputTokens === 'number' ||
        typeof msg.outputTokens === 'number';
      if (hasTokenInfo) {
        messagesWithTokenData += 1;
        if (typeof msg.inputTokens === 'number') inputTokens += msg.inputTokens;
        if (typeof msg.outputTokens === 'number')
          outputTokens += msg.outputTokens;
      }

      if (msg.metadata && typeof msg.metadata === 'object') {
        const meta = msg.metadata as Record<string, unknown>;
        if (typeof meta.durationMs === 'number' && meta.durationMs >= 0) {
          durationSum += meta.durationMs;
          durationCount += 1;
        }
      }
    }

    return {
      model: this.model,
      modelDisplayName: this.modelDisplayName,
      freeTierNotice:
        'Sử dụng Gemini Developer API Free Tier. Hạn mức RPM/TPM/RPD bị giới hạn theo project và đặt lại định kỳ.',
      totals: {
        assistantMessages: assistantMessages.length,
        completedMessages,
        failedMessages,
        cancelledMessages,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        messagesWithTokenData,
        averageDurationMs:
          durationCount > 0 ? Math.round(durationSum / durationCount) : null,
      },
    };
  }
}
