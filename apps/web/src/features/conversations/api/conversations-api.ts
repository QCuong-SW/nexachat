import type {
  ChatMessage,
  ConversationSummary,
} from '@/features/chat/types/chat.types';
import { apiRequest } from '@/lib/api-client';

export interface ConversationListResponse {
  items: ConversationSummary[];
  nextCursor: string | null;
}

export interface ConversationMessagesResponse {
  conversation: ConversationSummary;
  items: ChatMessage[];
  nextCursor: string | null;
}

export const conversationsApi = {
  list: (params?: { search?: string; limit?: number; cursor?: string }) => {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.cursor) query.set('cursor', params.cursor);
    const qs = query.toString();
    return apiRequest<ConversationListResponse>(
      `/conversations${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
    );
  },

  create: (payload: { title?: string } = {}) =>
    apiRequest<{ conversation: ConversationSummary }>('/conversations', {
      method: 'POST',
      body: payload,
    }),

  getMessages: (
    conversationId: string,
    params?: { limit?: number; cursor?: string },
  ) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.cursor) query.set('cursor', params.cursor);
    const qs = query.toString();
    return apiRequest<ConversationMessagesResponse>(
      `/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
    );
  },

  rename: (conversationId: string, title: string) =>
    apiRequest<{ conversation: ConversationSummary }>(
      `/conversations/${conversationId}`,
      {
        method: 'PATCH',
        body: { title },
      },
    ),

  remove: (conversationId: string) =>
    apiRequest<{ success: boolean }>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    }),
};
