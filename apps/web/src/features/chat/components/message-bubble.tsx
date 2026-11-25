'use client';

import {
  Bot,
  Check,
  Copy,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '../types/chat.types';
import { MarkdownContent } from './markdown-content';

interface MessageBubbleProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRegenerate?: () => void;
}

export function MessageBubble({
  message,
  isLastAssistant,
  isStreaming,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'USER';
  const isPending = message.status === 'PENDING';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-sm leading-relaxed text-white shadow-xs whitespace-pre-wrap">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          <UserIcon className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600">
        <Bot className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-slate-200/90 bg-white px-4 py-3.5 shadow-xs">
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : isPending ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
              Đang sinh phản hồi...
            </div>
          ) : null}

          {isPending && message.content && (
            <span
              className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-xs bg-indigo-500 align-middle"
              aria-label="Đang truyền dữ liệu"
            />
          )}
        </div>

        {/* Status, token usage & actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {message.status === 'CANCELLED' && (
              <Badge variant="warning">Đã dừng tạo phản hồi</Badge>
            )}
            {message.status === 'FAILED' && (
              <Badge variant="warning">Phản hồi gặp lỗi</Badge>
            )}
            {(message.inputTokens != null || message.outputTokens != null) && (
              <span className="text-[11px] text-slate-400">
                Tokens: {message.inputTokens ?? '—'} in /{' '}
                {message.outputTokens ?? '—'} out
              </span>
            )}
          </div>

          {!isPending && message.content && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-xs text-slate-500"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Sao chép
                  </>
                )}
              </Button>

              {isLastAssistant && onRegenerate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isStreaming}
                  onClick={onRegenerate}
                  className="h-7 px-2 text-xs text-slate-500"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tạo lại
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
