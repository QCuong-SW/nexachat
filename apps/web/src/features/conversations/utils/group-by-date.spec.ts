import { describe, expect, it } from 'vitest';
import { groupConversationsByDate } from './group-by-date';

describe('groupConversationsByDate', () => {
  it('groups conversations into Today, Previous 7 Days, and Older', () => {
    const now = new Date('2026-11-23T12:00:00.000Z');
    const items = [
      {
        id: '1',
        title: 'Today chat',
        createdAt: '2026-11-23T08:00:00.000Z',
        updatedAt: '2026-11-23T08:00:00.000Z',
        lastMessageAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: '2',
        title: '3 days ago chat',
        createdAt: '2026-11-20T08:00:00.000Z',
        updatedAt: '2026-11-20T08:00:00.000Z',
        lastMessageAt: '2026-11-20T08:00:00.000Z',
      },
      {
        id: '3',
        title: '20 days ago chat',
        createdAt: '2026-11-03T08:00:00.000Z',
        updatedAt: '2026-11-03T08:00:00.000Z',
        lastMessageAt: '2026-11-03T08:00:00.000Z',
      },
    ];

    const grouped = groupConversationsByDate(items, now);
    expect(grouped.today.map((c) => c.id)).toEqual(['1']);
    expect(grouped.previous7Days.map((c) => c.id)).toEqual(['2']);
    expect(grouped.older.map((c) => c.id)).toEqual(['3']);
  });
});
