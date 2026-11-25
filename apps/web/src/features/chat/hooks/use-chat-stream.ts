'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { conversationKeys } from '@/features/conversations/hooks/use-conversations';
import type { ModelSettings } from '@/features/settings/api/settings-storage';
import { ApiError } from '@/lib/api-client';
import {
  streamConversationMessage,
  type ChatStreamEvent,
} from '../api/chat-stream-api';
import type { ChatMessage } from '../types/chat.types';

export function useChatStream() {
  const queryClient = useQueryClient();
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>(
    [],
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setOptimisticMessages((prev) =>
      prev.map((m) =>
        m.role === 'ASSISTANT' && m.status === 'PENDING'
          ? { ...m, status: 'CANCELLED' }
          : m,
      ),
    );
  }, []);

  const clearError = useCallback(() => setErrorMessage(null), []);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      config?: Partial<ModelSettings>,
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const nowIso = new Date().toISOString();
      const tempUserId = `temp-user-${Date.now()}`;
      const tempAssistantId = `temp-assistant-${Date.now()}`;

      setErrorMessage(null);
      setIsStreaming(true);
      setOptimisticMessages([
        {
          id: tempUserId,
          conversationId,
          role: 'USER',
          content: trimmed,
          status: 'COMPLETED',
          createdAt: nowIso,
        },
        {
          id: tempAssistantId,
          conversationId,
          role: 'ASSISTANT',
          content: '',
          status: 'PENDING',
          createdAt: nowIso,
        },
      ]);

      let activeAssistantId = tempAssistantId;

      const handleEvent = (ev: ChatStreamEvent) => {
        if (ev.event === 'message.started') {
          activeAssistantId = ev.data.assistantMessageId;
          setOptimisticMessages((prev) =>
            prev.map((m) => {
              if (m.id === tempUserId) {
                return { ...m, id: ev.data.userMessageId };
              }
              if (m.id === tempAssistantId) {
                return {
                  ...m,
                  id: ev.data.assistantMessageId,
                  model: ev.data.model,
                };
              }
              return m;
            }),
          );
        } else if (ev.event === 'message.delta') {
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === activeAssistantId || m.id === ev.data.assistantMessageId
                ? { ...m, content: m.content + ev.data.delta }
                : m,
            ),
          );
        } else if (ev.event === 'message.completed') {
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.id === activeAssistantId || m.id === ev.data.assistantMessageId
                ? {
                    ...m,
                    content: ev.data.content,
                    status: 'COMPLETED',
                    model: ev.data.model,
                    inputTokens: ev.data.inputTokens,
                    outputTokens: ev.data.outputTokens,
                    finishReason: ev.data.finishReason,
                  }
                : m,
            ),
          );
        } else if (ev.event === 'message.error') {
          setErrorMessage(ev.data.message);
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.role === 'ASSISTANT' ? { ...m, status: 'FAILED' } : m,
            ),
          );
        }
      };

      try {
        await streamConversationMessage(
          conversationId,
          { content: trimmed, config },
          {
            signal: controller.signal,
            onEvent: handleEvent,
          },
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.role === 'ASSISTANT' && m.status === 'PENDING'
                ? { ...m, status: 'CANCELLED' }
                : m,
            ),
          );
        } else if (err instanceof ApiError) {
          setErrorMessage(err.message);
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.role === 'ASSISTANT' ? { ...m, status: 'FAILED' } : m,
            ),
          );
        } else {
          setErrorMessage('Đã xảy ra lỗi trong quá trình nhận phản hồi.');
          setOptimisticMessages((prev) =>
            prev.map((m) =>
              m.role === 'ASSISTANT' ? { ...m, status: 'FAILED' } : m,
            ),
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: conversationKeys.messages(conversationId),
          }),
          queryClient.invalidateQueries({
            queryKey: conversationKeys.all,
          }),
          queryClient.invalidateQueries({
            queryKey: ['usage', 'me'],
          }),
        ]);
        setOptimisticMessages([]);
      }
    },
    [queryClient],
  );

  return {
    optimisticMessages,
    isStreaming,
    errorMessage,
    sendMessage,
    stopGeneration,
    clearError,
  };
}
