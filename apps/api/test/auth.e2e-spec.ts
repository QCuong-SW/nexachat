import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';

interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

function createInMemoryPrismaMock() {
  const users = new Map<string, InMemoryUser>();

  const projectUser = (
    user: InMemoryUser,
    select?: Record<string, boolean>,
  ): Record<string, unknown> => {
    if (!select) {
      return { ...user };
    }
    const out: Record<string, unknown> = {};
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled && key in user) {
        out[key] = user[key as keyof InMemoryUser];
      }
    }
    return out;
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
          let found: InMemoryUser | undefined;
          if (where.id) {
            found = users.get(where.id);
          } else if (where.email) {
            found = [...users.values()].find((u) => u.email === where.email);
          }
          return found ? projectUser(found, select) : null;
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
          return projectUser(record, select);
        },
      ),
    },
    _reset: () => users.clear(),
  };
}

describe('Auth API (Supertest integration)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createInMemoryPrismaMock>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://nexa_user:test@127.0.0.1:5432/nexa_chat_test?schema=public';
    process.env.JWT_SECRET =
      'test_jwt_secret_key_that_is_definitely_longer_than_32_chars';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.COOKIE_NAME = 'nexa_session';

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

  it('registers user, sets HttpOnly SameSite=Lax cookie, never exposes passwordHash, and authenticates /auth/me', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: '  Demo.User@Example.COM ',
        password: 'SecurePassword123!',
        displayName: 'Demo User',
      })
      .expect(201);

    expect(registerRes.body.user).toMatchObject({
      email: 'demo.user@example.com',
      displayName: 'Demo User',
    });
    expect(registerRes.body.user.passwordHash).toBeUndefined();

    const setCookieHeader = registerRes.headers['set-cookie'];
    expect(Array.isArray(setCookieHeader)).toBe(true);
    const sessionCookie = (setCookieHeader as unknown as string[]).find((c) =>
      c.startsWith('nexa_session='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie!)
      .expect(200);

    expect(meRes.body.user.email).toBe('demo.user@example.com');
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });

  it('rejects /auth/me without cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(res.body.error).toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('supports login and logout flow', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'bob@example.com',
        password: 'BobPassword123!',
        displayName: 'Bob',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'BOB@example.com',
        password: 'BobPassword123!',
      })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const sessionCookie = cookies.find((c) => c.startsWith('nexa_session='));
    expect(sessionCookie).toBeDefined();

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', sessionCookie!)
      .expect(200);

    expect(logoutRes.body).toEqual({ success: true });
    const clearedCookies = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(clearedCookies.some((c) => c.startsWith('nexa_session=;'))).toBe(true);
  });

  it('rejects state-changing requests from disallowed Origin with 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://malicious.example')
      .send({
        email: 'bob@example.com',
        password: 'BobPassword123!',
      })
      .expect(403);

    expect(res.body.error.code).toBe('INVALID_ORIGIN');
  });

  it('rejects unknown fields and invalid payloads via ValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'not-an-email',
        password: '123',
        displayName: 'A',
        role: 'ADMIN',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
