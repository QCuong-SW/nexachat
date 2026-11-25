import { randomUUID } from 'node:crypto';
import type { MessageRole, MessageStatus } from '@prisma/client';

export interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  deletedAt: Date | null;
}

export interface InMemoryMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  finishReason: string | null;
  metadata: unknown;
  createdAt: Date;
}

function applySelect<T extends object>(
  item: T,
  select?: Record<string, boolean>,
): Record<string, unknown> {
  if (!select) {
    return { ...item } as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled && key in item) {
      out[key] = (item as Record<string, unknown>)[key];
    }
  }
  return out;
}

export function createInMemoryPrismaMock() {
  const users = new Map<string, InMemoryUser>();
  const conversations = new Map<string, InMemoryConversation>();
  const messages = new Map<string, InMemoryMessage>();

  const matchesConversationWhere = (
    c: InMemoryConversation,
    where?: Record<string, unknown>,
  ): boolean => {
    if (!where) return true;
    if (where.id !== undefined && c.id !== where.id) return false;
    if (where.userId !== undefined && c.userId !== where.userId) return false;
    if (where.deletedAt === null && c.deletedAt !== null) return false;
    if (where.title && typeof where.title === 'object') {
      const filter = where.title as { contains?: string; mode?: string };
      if (filter.contains) {
        const needle =
          filter.mode === 'insensitive'
            ? filter.contains.toLowerCase()
            : filter.contains;
        const haystack =
          filter.mode === 'insensitive' ? c.title.toLowerCase() : c.title;
        if (!haystack.includes(needle)) return false;
      }
    }
    return true;
  };

  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { id?: string; email?: string };
          select?: Record<string, boolean>;
        }) => {
          const found = where.id
            ? users.get(where.id)
            : [...users.values()].find((u) => u.email === where.email);
          return found ? applySelect(found, select) : null;
        },
      ),
      create: jest.fn(
        async ({
          data,
          select,
        }: {
          data: { email: string; passwordHash: string; displayName: string };
          select?: Record<string, boolean>;
        }) => {
          const now = new Date();
          const record: InMemoryUser = {
            id: randomUUID(),
            email: data.email,
            passwordHash: data.passwordHash,
            displayName: data.displayName,
            createdAt: now,
            updatedAt: now,
          };
          users.set(record.id, record);
          return applySelect(record, select);
        },
      ),
    },
    conversation: {
      findMany: jest.fn(
        async ({
          where,
          take,
          cursor,
          skip,
        }: {
          where?: Record<string, unknown>;
          take?: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          let list = [...conversations.values()]
            .filter((c) => matchesConversationWhere(c, where))
            .sort(
              (a, b) =>
                b.lastMessageAt.getTime() - a.lastMessageAt.getTime() ||
                b.id.localeCompare(a.id),
            );
          if (cursor?.id) {
            const idx = list.findIndex((c) => c.id === cursor.id);
            if (idx >= 0) {
              list = list.slice(idx + (skip ?? 0));
            }
          }
          if (take !== undefined) {
            list = list.slice(0, take);
          }
          return list.map((c) => ({ ...c }));
        },
      ),
      findFirst: jest.fn(
        async ({ where }: { where?: Record<string, unknown> }) => {
          const found = [...conversations.values()].find((c) =>
            matchesConversationWhere(c, where),
          );
          return found ? { ...found } : null;
        },
      ),
      create: jest.fn(
        async ({ data }: { data: { userId: string; title: string } }) => {
          const now = new Date();
          const record: InMemoryConversation = {
            id: randomUUID(),
            userId: data.userId,
            title: data.title,
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
            deletedAt: null,
          };
          conversations.set(record.id, record);
          return { ...record };
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where?: Record<string, unknown>;
          data: Partial<InMemoryConversation>;
        }) => {
          let count = 0;
          for (const c of conversations.values()) {
            if (matchesConversationWhere(c, where)) {
              Object.assign(c, data, { updatedAt: new Date() });
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    message: {
      findMany: jest.fn(
        async ({
          where,
          orderBy,
          take,
          cursor,
          skip,
        }: {
          where?: {
            conversationId?: string;
            status?: MessageStatus;
            role?: MessageRole;
            conversation?: { userId?: string; deletedAt?: null };
          };
          orderBy?: Array<Record<string, 'asc' | 'desc'>>;
          take?: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          let list = [...messages.values()].filter((m) => {
            if (
              where?.conversationId &&
              m.conversationId !== where.conversationId
            ) {
              return false;
            }
            if (where?.status && m.status !== where.status) {
              return false;
            }
            if (where?.role && m.role !== where.role) {
              return false;
            }
            if (where?.conversation) {
              const conv = conversations.get(m.conversationId);
              if (!conv) return false;
              if (
                where.conversation.userId &&
                conv.userId !== where.conversation.userId
              ) {
                return false;
              }
              if (
                where.conversation.deletedAt === null &&
                conv.deletedAt !== null
              ) {
                return false;
              }
            }
            return true;
          });
          const dir = orderBy?.[0]?.createdAt ?? 'asc';
          list.sort((a, b) =>
            dir === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          );
          if (cursor?.id) {
            const idx = list.findIndex((m) => m.id === cursor.id);
            if (idx >= 0) {
              list = list.slice(idx + (skip ?? 0));
            }
          }
          if (take !== undefined) {
            list = list.slice(0, take);
          }
          return list.map((m) => ({ ...m }));
        },
      ),
      count: jest.fn(
        async ({ where }: { where?: { conversationId?: string } }) => {
          return [...messages.values()].filter(
            (m) =>
              !where?.conversationId ||
              m.conversationId === where.conversationId,
          ).length;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: Omit<InMemoryMessage, 'id' | 'createdAt'>;
        }) => {
          const record: InMemoryMessage = {
            id: randomUUID(),
            conversationId: data.conversationId,
            role: data.role,
            content: data.content,
            status: data.status,
            model: data.model ?? null,
            inputTokens: data.inputTokens ?? null,
            outputTokens: data.outputTokens ?? null,
            finishReason: data.finishReason ?? null,
            metadata: data.metadata ?? null,
            createdAt: new Date(),
          };
          messages.set(record.id, record);
          return { ...record };
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<InMemoryMessage>;
        }) => {
          const existing = messages.get(where.id);
          if (!existing) throw new Error('Message not found');
          Object.assign(existing, data);
          return { ...existing };
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where?: { status?: MessageStatus };
          data: Partial<InMemoryMessage>;
        }) => {
          let count = 0;
          for (const m of messages.values()) {
            if (!where?.status || m.status === where.status) {
              Object.assign(m, data);
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    _reset: () => {
      users.clear();
      conversations.clear();
      messages.clear();
    },
  };
}
