import { MessageRole, MessageStatus, PrismaClient } from '@prisma/client';

/**
 * PostgreSQL 17 Database Integration Test thật (chạy qua `pnpm --filter @nexa-chat/api test:db`).
 * Yêu cầu container `nexa-chat-postgres` đang chạy và đã áp dụng migration cho `TEST_DATABASE_URL`.
 */
const testDbUrl = process.env.TEST_DATABASE_URL;
const describeIfDb = testDbUrl ? describe : describe.skip;

describeIfDb('PostgreSQL 17 Database Integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: { url: testDbUrl },
      },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists users, conversations, messages, enforces unique email, soft-delete, and cascade delete', async () => {
    const email = `db-int-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: '$argon2id$test',
        displayName: 'DB Integration User',
      },
    });

    try {
      const conv = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: 'PostgreSQL Integration Conversation',
        },
      });

      const msg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: MessageRole.ASSISTANT,
          content: 'Hello persisted world',
          status: MessageStatus.COMPLETED,
          model: 'gemini-3.5-flash-lite',
          inputTokens: 12,
          outputTokens: 6,
          finishReason: 'STOP',
          metadata: { durationMs: 125 },
        },
      });

      expect(msg.inputTokens).toBe(12);

      // Soft delete hides conversation from active query
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { deletedAt: new Date() },
      });

      const active = await prisma.conversation.findMany({
        where: { userId: user.id, deletedAt: null },
      });
      expect(active).toHaveLength(0);

      // Unique email constraint enforced by PostgreSQL
      await expect(
        prisma.user.create({
          data: {
            email,
            passwordHash: '$argon2id$dup',
            displayName: 'Dup',
          },
        }),
      ).rejects.toThrow();
    } finally {
      // Deleting user cascades to conversations and messages
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
