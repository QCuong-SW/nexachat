'use client';

import { Send, ShieldAlert, Square } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { env } from '@/lib/env';

interface ChatComposerProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  maxLength?: number;
}

export function ChatComposer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  maxLength = env.NEXT_PUBLIC_MAX_INPUT_CHARS,
}: ChatComposerProps) {
  const [value, setValue] = useState('');

  const trimmed = value.trim();
  const isTooLong = value.length > maxLength;
  const canSend = !disabled && !isStreaming && trimmed.length > 0 && !isTooLong;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        <div
          className={`rounded-2xl border bg-white p-2 shadow-xs transition-colors ${
            isTooLong
              ? 'border-red-400 ring-1 ring-red-200'
              : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100'
          }`}
        >
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={2}
            placeholder="Nhập tin nhắn của bạn... (Enter để gửi, Shift + Enter để xuống dòng)"
            aria-label="Nhập tin nhắn"
            className="max-h-44 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
          />

          <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
            <span
              className={`text-xs ${
                isTooLong ? 'font-medium text-red-600' : 'text-slate-400'
              }`}
            >
              {value.length.toLocaleString()} / {maxLength.toLocaleString()} ký
              tự
              {isTooLong ? ' — Đã vượt quá giới hạn độ dài tin nhắn.' : ''}
            </span>

            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onStop}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Dừng
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={!canSend}
                onClick={submit}
              >
                <Send className="h-3.5 w-3.5" />
                Gửi
              </Button>
            )}
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Sử dụng Gemini Free Tier (có giới hạn hạn mức). Không nhập mật khẩu
            hoặc thông tin cá nhân nhạy cảm.
          </span>
        </p>
      </div>
    </div>
  );
}
