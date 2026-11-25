import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import { LlmProviderError } from '../src/features/llm/errors/llm-provider.error';
import {
  LLM_PROVIDER,
  type ILlmProvider,
} from '../src/features/llm/interfaces/llm-provider.interface';
import { createInMemoryPrismaMock } from './helpers/in-memory-prisma';

describe('Chat Non-Streaming & Usage API (Supertest integration)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createInMemoryPrismaMock>;
  let llmProviderMock: jest.Mocked<ILlmProvider>;

  const registerAndGetCookie = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email,
        password: 'StrongPassword123!',
        displayName: 'Test User',
      })
      .expect(201);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return cookies.find((c) => c.startsWith('nexa_session='))!;
  };

  beforeAll(async () => {
    prismaMock = createInMemoryPrismaMock();
    llmProviderMock = {
      getModelId: jest.fn().mockReturnValue('gemini-3.5-flash-lite'),
      generate: jest.fn(),
      generateStream: jest.fn(),
      generateStructured: jest.fn(),
      generateWithTools: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(LLM_PROVIDER)
      .useValue(llmProviderMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    prismaMock._reset();
    jest.clearAllMocks();
    llmProviderMock.getModelId.mockReturnValue('gemini-3.5-flash-lite');
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends message via mocked LLM provider, persists usage, and reports it in /usage/me', async () => {
    const cookie = await registerAndGetCookie('llm-user@example.com');

    const convRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    const convId = convRes.body.conversation.id as string;

    llmProviderMock.generate.mockResolvedValue({
      content: 'Gemini Free Tier response!',
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 18, outputTokens: 7 },
      finishReason: 'STOP',
      durationMs: 145,
    });

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({
        content: 'Explain token usage',
        config: { temperature: 0.4, maxOutputTokens: 512 },
      })
      .expect(201);

    expect(sendRes.body.assistantMessage).toMatchObject({
      role: 'ASSISTANT',
      content: 'Gemini Free Tier response!',
      status: 'COMPLETED',
      model: 'gemini-3.5-flash-lite',
      inputTokens: 18,
      outputTokens: 7,
    });

    const usageRes = await request(app.getHttpServer())
      .get('/api/v1/usage/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(usageRes.body.model).toBe('gemini-3.5-flash-lite');
    expect(usageRes.body.totals).toMatchObject({
      assistantMessages: 1,
      completedMessages: 1,
      inputTokens: 18,
      outputTokens: 7,
      totalTokens: 25,
      averageDurationMs: 145,
    });
  });

  it('rejects arbitrary model field from client input and maps quota errors cleanly', async () => {
    const cookie = await registerAndGetCookie('quota-user@example.com');
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    const convId = convRes.body.conversation.id as string;

    // Client attempts to inject a paid model field -> rejected by forbidNonWhitelisted
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({
        content: 'Hello',
        model: 'gemini-2.5-pro-paid',
      })
      .expect(400);

    // Provider throws quota exceeded -> 429 LLM_QUOTA_EXCEEDED and FAILED recorded in DB
    llmProviderMock.generate.mockRejectedValue(
      new LlmProviderError(
        'LLM_QUOTA_EXCEEDED',
        'Hạn mức Gemini Free Tier đã đạt giới hạn.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    const quotaRes = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ content: 'Trigger quota test' })
      .expect(429);

    expect(quotaRes.body.error.code).toBe('LLM_QUOTA_EXCEEDED');

    const usageRes = await request(app.getHttpServer())
      .get('/api/v1/usage/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(usageRes.body.totals.failedMessages).toBe(1);
    expect(usageRes.body.totals.completedMessages).toBe(0);
  });
});
