'use client';

import { Sparkles } from 'lucide-react';

const PROMPT_SUGGESTIONS = [
  {
    title: 'Hiểu về Context Window',
    prompt:
      'Giải thích Context Window trong LLM là gì và cách kiểm soát độ dài lịch sử hội thoại hiệu quả.',
  },
  {
    title: 'So sánh Temperature',
    prompt:
      'Cho ví dụ sự khác nhau khi đặt temperature = 0.0 so với temperature = 1.2 khi viết câu trả lời kỹ thuật.',
  },
  {
    title: 'Structured Output',
    prompt:
      'Tại sao nên dùng Structured Output (JSON Schema) thay vì chỉ nhắc LLM "hãy trả về JSON" trong prompt?',
  },
  {
    title: 'Function Calling an toàn',
    prompt:
      'Những nguyên tắc bảo mật quan trọng nhất khi cho phép LLM gọi hàm backend (Function Calling) là gì?',
  },
];

interface EmptyChatStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export function EmptyChatState({ onSelectPrompt }: EmptyChatStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Chào mừng đến với Nexa Chat
      </h2>
      <p className="mt-1.5 max-w-lg text-sm text-slate-500">
        Bắt đầu một cuộc trò chuyện mới hoặc chọn một gợi ý bên dưới để khám phá
        các khái niệm LLM Engineering thực tế.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {PROMPT_SUGGESTIONS.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-indigo-300 hover:bg-indigo-50/30"
          >
            <p className="text-sm font-medium text-slate-900 group-hover:text-indigo-700">
              {item.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {item.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
