import { apiRequest } from '@/lib/api-client';

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

export const usageApi = {
  getMyUsage: () => apiRequest<UserUsageSummary>('/usage/me', { method: 'GET' }),
};
