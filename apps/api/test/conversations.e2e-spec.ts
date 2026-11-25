import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import { createInMemoryPrismaMock } from './helpers/in-memory-prisma';

describe('Conversations API & Ownership (Supertest integration)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createInMemoryPrismaMock>;

  const registerAndGetCookie = async (
    email: string,
    displayName: string,
  ): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email,
        password: 'StrongPassword123!',
        displayName,
      })
      .expect(201);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const sessionCookie = cookies.find((c) => c.startsWith('nexa_session='));
    expect(sessionCookie).toBeDefined();
    return sessionCookie!;
  };

  beforeAll(async () => {
    prismaMock = createInMemoryPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    prismaMock._reset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access to conversation endpoints with 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/conversations').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .send({ title: 'Unauthorized' })
      .expect(401);
  });

  it('supports CRUD, search by title, soft delete, and enforces strict per-user ownership', async () => {
    const cookieA = await registerAndGetCookie('alice@example.com', 'Alice');
    const cookieB = await registerAndGetCookie('bob@example.com', 'Bob');

    // User A creates two conversations
    const conv1Res = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieA)
      .send({ title: 'Tìm hiểu Streaming SSE' })
      .expect(201);
    const conv1Id = conv1Res.body.conversation.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieA)
      .send({ title: 'Học Prisma ORM' })
      .expect(201);

    // Search by title (case-insensitive)
    const searchRes = await request(app.getHttpServer())
      .get('/api/v1/conversations?search=streaming')
      .set('Cookie', cookieA)
      .expect(200);
    expect(searchRes.body.items).toHaveLength(1);
    expect(searchRes.body.items[0].id).toBe(conv1Id);

    // User B lists conversations -> sees 0 (never leaks User A's conversations)
    const bobListRes = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Cookie', cookieB)
      .expect(200);
    expect(bobListRes.body.items).toHaveLength(0);

    // User B tries to read messages, rename, or delete User A's conversation -> 404
    await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conv1Id}/messages`)
      .set('Cookie', cookieB)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/conversations/${conv1Id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieB)
      .send({ title: 'Hijacked title' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/conversations/${conv1Id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieB)
      .expect(404);

    // User A renames conversation
    const renameRes = await request(app.getHttpServer())
      .patch(`/api/v1/conversations/${conv1Id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieA)
      .send({ title: 'Streaming SSE nâng cao' })
      .expect(200);
    expect(renameRes.body.conversation.title).toBe('Streaming SSE nâng cao');

    // User A reads own messages
    const msgRes = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conv1Id}/messages`)
      .set('Cookie', cookieA)
      .expect(200);
    expect(msgRes.body.conversation.id).toBe(conv1Id);
    expect(msgRes.body.items).toEqual([]);

    // User A soft-deletes conversation
    await request(app.getHttpServer())
      .delete(`/api/v1/conversations/${conv1Id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieA)
      .expect(200);

    // Soft-deleted conversation is hidden from list and returns 404 on access
    const listAfterDelete = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Cookie', cookieA)
      .expect(200);
    expect(listAfterDelete.body.items).toHaveLength(1);
    expect(
      listAfterDelete.body.items.some((c: { id: string }) => c.id === conv1Id),
    ).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conv1Id}/messages`)
      .set('Cookie', cookieA)
      .expect(404);
  });
});
