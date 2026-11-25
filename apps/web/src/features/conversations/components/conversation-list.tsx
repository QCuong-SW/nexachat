'use client';

import type { ConversationSummary } from '@/features/chat/types/chat.types';
import { groupConversationsByDate } from '../utils/group-by-date';
import { ConversationItem } from './conversation-item';

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeId?: string;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  onRename,
  onDelete,
  onNavigate,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-xs text-slate-400">
        Không tìm thấy hội thoại nào.
      </div>
    );
  }

  const groups = groupConversationsByDate(conversations);
  const sections = [
    { key: 'today', label: 'Today', items: groups.today },
    {
      key: 'previous7Days',
      label: 'Previous 7 Days',
      items: groups.previous7Days,
    },
    { key: 'older', label: 'Older', items: groups.older },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key} className="space-y-1">
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeId}
                onRename={onRename}
                onDelete={onDelete}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
