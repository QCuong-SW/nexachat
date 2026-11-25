'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../api/conversations-api';

export const conversationKeys = {
  all: ['conversations'] as const,
  list: (search?: string) => ['conversations', 'list', search ?? ''] as const,
  messages: (conversationId: string) =>
    ['conversations', conversationId, 'messages'] as const,
};

export function useConversations(search?: string) {
  return useQuery({
    queryKey: conversationKeys.list(search),
    queryFn: () => conversationsApi.list({ search, limit: 50 }),
  });
}

export function useConversationMessages(conversationId?: string) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId ?? ''),
    queryFn: () => conversationsApi.getMessages(conversationId!, { limit: 100 }),
    enabled: Boolean(conversationId),
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { title?: string }) =>
      conversationsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      conversationsApi.rename(id, title),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      void queryClient.invalidateQueries({
        queryKey: conversationKeys.messages(variables.id),
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.remove(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      queryClient.removeQueries({ queryKey: conversationKeys.messages(id) });
    },
  });
}
