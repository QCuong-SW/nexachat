import type { ConversationSummary } from '@/features/chat/types/chat.types';

export interface GroupedConversations {
  today: ConversationSummary[];
  previous7Days: ConversationSummary[];
  older: ConversationSummary[];
}

export function groupConversationsByDate(
  conversations: ConversationSummary[],
  now: Date = new Date(),
): GroupedConversations {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );

  const grouped: GroupedConversations = {
    today: [],
    previous7Days: [],
    older: [],
  };

  for (const item of sorted) {
    const ts = new Date(item.lastMessageAt).getTime();
    if (ts >= startOfToday) {
      grouped.today.push(item);
    } else if (ts >= sevenDaysAgo) {
      grouped.previous7Days.push(item);
    } else {
      grouped.older.push(item);
    }
  }

  return grouped;
}
