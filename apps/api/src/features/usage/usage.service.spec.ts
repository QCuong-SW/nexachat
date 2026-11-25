import { ConfigService } from '@nestjs/config';
import { MessageStatus } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { UsageService } from './usage.service';

describe('UsageService', () => {
  it('aggregates real token counts and average duration without fabricating missing tokens', async () => {
    const prisma = {
      message: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: MessageStatus.COMPLETED,
            inputTokens: 20,
            outputTokens: 40,
            metadata: { durationMs: 300 },
          },
          {
            status: MessageStatus.COMPLETED,
            inputTokens: null,
            outputTokens: null,
            metadata: { durationMs: 500 },
          },
          {
            status: MessageStatus.FAILED,
            inputTokens: null,
            outputTokens: null,
            metadata: { errorCode: 'LLM_QUOTA_EXCEEDED' },
          },
        ]),
      },
    } as unknown as PrismaService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'gemini.model') return 'gemini-3.5-flash-lite';
        if (key === 'gemini.modelDisplayName')
          return 'Gemini 3.5 Flash-Lite — Free Tier';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new UsageService(prisma, configService);
    const summary = await service.getUserUsage('user-1');

    expect(summary.model).toBe('gemini-3.5-flash-lite');
    expect(summary.totals).toEqual({
      assistantMessages: 3,
      completedMessages: 2,
      failedMessages: 1,
      cancelledMessages: 0,
      inputTokens: 20,
      outputTokens: 40,
      totalTokens: 60,
      messagesWithTokenData: 1,
      averageDurationMs: 400,
    });
  });
});
