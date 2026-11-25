import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import {
  LLM_PROVIDER,
  type ILlmProvider,
} from '../src/features/llm/interfaces/llm-provider.interface';
import { createInMemoryPrismaMock } from './helpers/in-memory-prisma';

describe('LLM Experiments API — Structured Output & Function Calling (Supertest)', () => {
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
        displayName: 'Lab User',
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

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/llm/summarize')
      .set('Origin', 'http://localhost:3000')
      .send({ text: 'Đoạn văn bản cần tóm tắt đủ dài.' })
      .expect(401);
  });

  it('POST /api/v1/llm/summarize validates structured output and rejects malformed model output', async () => {
    const cookie = await registerAndGetCookie('struct@example.com');

    llmProviderMock.generateStructured.mockResolvedValueOnce({
      data: {
        title: 'Nexa Chat Architecture',
        summary: 'Monorepo gồm NestJS API và Next.js Web kết nối Gemini Free Tier.',
        keyPoints: ['NestJS package-by-feature', 'Next.js App Router'],
      },
      rawText: '{}',
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 35, outputTokens: 28 },
      finishReason: 'STOP',
      durationMs: 160,
    });

    const okRes = await request(app.getHttpServer())
      .post('/api/v1/llm/summarize')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({
        text: 'Nexa Chat là dự án học LLM Engineering gồm NestJS API và Next.js Web.',
      })
      .expect(200);

    expect(okRes.body.result).toEqual({
      title: 'Nexa Chat Architecture',
      summary: 'Monorepo gồm NestJS API và Next.js Web kết nối Gemini Free Tier.',
      keyPoints: ['NestJS package-by-feature', 'Next.js App Router'],
    });

    // Malformed model JSON -> 502 LLM_INVALID_OUTPUT
    llmProviderMock.generateStructured.mockResolvedValueOnce({
      data: { title: 123, summary: '' },
      rawText: '{}',
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 10, outputTokens: 5 },
      finishReason: 'STOP',
      durationMs: 90,
    });

    const badRes = await request(app.getHttpServer())
      .post('/api/v1/llm/summarize')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({
        text: 'Đoạn văn bản kiểm tra lỗi schema trả về từ mô hình.',
      })
      .expect(502);

    expect(badRes.body.error.code).toBe('LLM_INVALID_OUTPUT');
  });

  it('POST /api/v1/llm/tools/run executes allowlisted get_current_time and returns trace + answer', async () => {
    const cookie = await registerAndGetCookie('tools@example.com');

    llmProviderMock.generateWithTools
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [
          { name: 'get_current_time', args: { timezone: 'Asia/Ho_Chi_Minh' } },
        ],
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 50, outputTokens: 12 },
        finishReason: 'STOP',
        durationMs: 120,
      })
      .mockResolvedValueOnce({
        text: 'Hiện tại ở múi giờ Asia/Ho_Chi_Minh đã được lấy từ server.',
        functionCalls: [],
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 70, outputTokens: 18 },
        finishReason: 'STOP',
        durationMs: 130,
      });

    const res = await request(app.getHttpServer())
      .post('/api/v1/llm/tools/run')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ prompt: 'Bây giờ là mấy giờ ở Việt Nam?' })
      .expect(200);

    expect(res.body.answer).toContain('Asia/Ho_Chi_Minh');
    expect(res.body.toolExecutions).toHaveLength(1);
    expect(res.body.toolExecutions[0]).toMatchObject({
      toolName: 'get_current_time',
      status: 'completed',
    });
  });
});
