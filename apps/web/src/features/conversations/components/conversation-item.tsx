'use client';

import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ConversationSummary } from '@/features/chat/types/chat.types';
import { cn } from '@/lib/utils';

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onRename,
  onDelete,
  onNavigate,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title);

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    } else {
      setDraftTitle(conversation.title);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5">
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraftTitle(conversation.title);
              setIsEditing(false);
            }
          }}
          aria-label="Đổi tên hội thoại"
          autoFocus
          className="w-full min-w-0 rounded border border-indigo-300 bg-white px-2 py-0.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={commitRename}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
          aria-label="Lưu tên mới"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDraftTitle(conversation.title);
            setIsEditing(false);
          }}
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
          aria-label="Huỷ đổi tên"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-sm transition-colors',
        isActive
          ? 'bg-indigo-50 font-medium text-indigo-700'
          : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      <Link
        href={`/chat/${conversation.id}`}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-2"
        title={conversation.title}
      >
        <MessageSquare
          className={cn(
            'h-4 w-4 shrink-0',
            isActive ? 'text-indigo-600' : 'text-slate-400',
          )}
        />
        <span className="truncate text-[13px]">{conversation.title}</span>
      </Link>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setDraftTitle(conversation.title);
            setIsEditing(true);
          }}
          className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
          aria-label={`Đổi tên ${conversation.title}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete(conversation.id);
          }}
          className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
          aria-label={`Xoá ${conversation.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
