'use client';

import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '../types/chat.types';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onRegenerate?: () => void;
}

export function MessageList({
  messages,
  isLoading = false,
  isStreaming = false,
  errorMessage = null,
  onRetry,
  onRegenerate,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  if (isLoading) {
    return (
      <div
        role="status"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-2 py-12 text-sm text-slate-500"
      >
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span>Đang tải lịch sử hội thoại...</span>
      </div>
    );
  }

  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'ASSISTANT') {
      lastAssistantIndex = i;
      break;
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLastAssistant={index === lastAssistantIndex}
          isStreaming={isStreaming}
          onRegenerate={onRegenerate}
        />
      ))}

      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-200 bg-white text-red-700 hover:bg-red-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </Button>
          )}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
