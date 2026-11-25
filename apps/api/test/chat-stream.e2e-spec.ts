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
  type LlmStreamChunk,
} from '../src/features/llm/interfaces/llm-provider.interface';
import { createInMemoryPrismaMock } from './helpers/in-memory-prisma';

function parseRawSse(body: string): Array<{ event: string; data: unknown }> {
  return body
    .split('\n\n')
    .filter((f) => f.trim().length > 0)
    .map((frame) => {
      let event = '';
      let dataLine = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) dataLine = line.slice(5).trim();
      }
      return { event, data: JSON.parse(dataLine) };
    });
}

describe('Chat Streaming SSE API (Supertest integration)', () => {
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
        displayName: 'Stream User',
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

  it('streams started -> delta -> completed events with proper SSE headers and persists tokens', async () => {
    const cookie = await registerAndGetCookie('stream-ok@example.com');
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    const convId = convRes.body.conversation.id as string;

    async function* mockStream(): AsyncIterable<LlmStreamChunk> {
      yield { type: 'delta', delta: 'Xin chào ' };
      yield { type: 'delta', delta: 'từ Gemini!' };
      yield {
        type: 'done',
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 14, outputTokens: 6 },
        finishReason: 'STOP',
      };
    }
    llmProviderMock.generateStream.mockReturnValue(mockStream());

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages/stream`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ content: 'Chào bạn' })
      .expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['x-accel-buffering']).toBe('no');

    const events = parseRawSse(res.text);
    expect(events.map((e) => e.event)).toEqual([
      'message.started',
      'message.delta',
      'message.delta',
      'message.completed',
    ]);
    expect(events[3].data).toMatchObject({
      content: 'Xin chào từ Gemini!',
      inputTokens: 14,
      outputTokens: 6,
      finishReason: 'STOP',
    });

    // Verify persisted history
    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${convId}/messages`)
      .set('Cookie', cookie)
      .expect(200);
    expect(historyRes.body.items).toHaveLength(2);
    expect(historyRes.body.items[1]).toMatchObject({
      role: 'ASSISTANT',
      status: 'COMPLETED',
      content: 'Xin chào từ Gemini!',
      inputTokens: 14,
      outputTokens: 6,
    });
  });

  it('emits message.error and marks assistant FAILED (never COMPLETED) on mid-stream quota error', async () => {
    const cookie = await registerAndGetCookie('stream-err@example.com');
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    const convId = convRes.body.conversation.id as string;

    async function* failingStream(): AsyncIterable<LlmStreamChunk> {
      yield { type: 'delta', delta: 'Phần đầu...' };
      throw new LlmProviderError(
        'LLM_QUOTA_EXCEEDED',
        'Hạn mức Gemini Free Tier đã đạt giới hạn.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    llmProviderMock.generateStream.mockReturnValue(failingStream());

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages/stream`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ content: 'Gây lỗi quota giữa chừng' })
      .expect(200);

    const events = parseRawSse(res.text);
    expect(events.map((e) => e.event)).toEqual([
      'message.started',
      'message.delta',
      'message.error',
    ]);
    expect(events[2].data).toMatchObject({
      code: 'LLM_QUOTA_EXCEEDED',
    });

    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${convId}/messages`)
      .set('Cookie', cookie)
      .expect(200);
    expect(historyRes.body.items[1]).toMatchObject({
      status: 'FAILED',
      content: 'Phần đầu...',
    });
  });

  it('marks assistant CANCELLED (never COMPLETED) and preserves partial text when cancelled', async () => {
    const cookie = await registerAndGetCookie('stream-cancel@example.com');
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    const convId = convRes.body.conversation.id as string;

    async function* cancelledStream(): AsyncIterable<LlmStreamChunk> {
      yield { type: 'delta', delta: 'Đang viết dở...' };
      throw new LlmProviderError(
        'LLM_CANCELLED',
        'Yêu cầu đã bị huỷ.',
        HttpStatus.BAD_REQUEST,
      );
    }
    llmProviderMock.generateStream.mockReturnValue(cancelledStream());

    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages/stream`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ content: 'Dừng giữa chừng' })
      .expect(200);

    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${convId}/messages`)
      .set('Cookie', cookie)
      .expect(200);
    expect(historyRes.body.items[1]).toMatchObject({
      status: 'CANCELLED',
      content: 'Đang viết dở...',
    });
  });

  it('returns 404 before opening SSE when conversation belongs to another user', async () => {
    const cookieA = await registerAndGetCookie('owner-a@example.com');
    const cookieB = await registerAndGetCookie('other-b@example.com');

    const convRes = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieA)
      .send({})
      .expect(201);
    const convId = convRes.body.conversation.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/messages/stream`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieB)
      .send({ content: 'Unauthorized stream attempt' })
      .expect(404);
  });
});
