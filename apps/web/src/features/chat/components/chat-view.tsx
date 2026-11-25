'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef } from 'react';
import {
  useConversationMessages,
  useCreateConversation,
} from '@/features/conversations/hooks/use-conversations';
import { useModelSettings } from '@/features/settings/hooks/use-model-settings';
import { ApiError } from '@/lib/api-client';
import { useChatStream } from '../hooks/use-chat-stream';
import type { ChatMessage } from '../types/chat.types';
import { ChatComposer } from './chat-composer';
import { EmptyChatState } from './empty-chat-state';
import { MessageList } from './message-list';

interface ChatViewProps {
  conversationId?: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const router = useRouter();
  const { settings } = useModelSettings();
  const createConversation = useCreateConversation();
  const lastSubmittedPromptRef = useRef<string | null>(null);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useConversationMessages(conversationId);

  const {
    optimisticMessages,
    isStreaming,
    errorMessage: streamError,
    sendMessage,
    stopGeneration,
    clearError,
  } = useChatStream();

  const mergedMessages = useMemo<ChatMessage[]>(() => {
    const persisted = data?.items ?? [];
    if (optimisticMessages.length === 0) {
      return persisted;
    }
    const existingIds = new Set(persisted.map((m) => m.id));
    const extras = optimisticMessages.filter((m) => !existingIds.has(m.id));
    return [...persisted, ...extras];
  }, [data?.items, optimisticMessages]);

  const loadError =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Không thể tải lịch sử hội thoại.'
        : null;

  const handleSend = async (content: string) => {
    clearError();
    lastSubmittedPromptRef.current = content;

    let targetConversationId = conversationId;
    if (!targetConversationId) {
      const created = await createConversation.mutateAsync({});
      targetConversationId = created.conversation.id;
      router.push(`/chat/${targetConversationId}`);
    }

    await sendMessage(targetConversationId, content, {
      temperature: settings.temperature,
      maxOutputTokens: settings.maxOutputTokens,
    });
  };

  const handleRegenerate = () => {
    if (!conversationId || isStreaming) return;
    const lastUserMessage = [...mergedMessages]
      .reverse()
      .find((m) => m.role === 'USER');
    const promptToRetry =
      lastUserMessage?.content ?? lastSubmittedPromptRef.current;
    if (!promptToRetry) return;
    void handleSend(promptToRetry);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!conversationId && mergedMessages.length === 0 ? (
          <EmptyChatState onSelectPrompt={(p) => void handleSend(p)} />
        ) : !isLoading && !loadError && mergedMessages.length === 0 ? (
          <EmptyChatState onSelectPrompt={(p) => void handleSend(p)} />
        ) : (
          <MessageList
            messages={mergedMessages}
            isLoading={isLoading && mergedMessages.length === 0}
            isStreaming={isStreaming}
            errorMessage={streamError ?? loadError}
            onRetry={() => {
              if (loadError) {
                void refetch();
              } else {
                handleRegenerate();
              }
            }}
            onRegenerate={handleRegenerate}
          />
        )}
      </div>

      <ChatComposer
        onSend={(content) => void handleSend(content)}
        onStop={stopGeneration}
        isStreaming={isStreaming}
        disabled={createConversation.isPending}
      />
    </div>
  );
}
