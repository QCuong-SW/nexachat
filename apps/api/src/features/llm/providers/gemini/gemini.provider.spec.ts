import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProviderError } from '../../errors/llm-provider.error';
import { GeminiProvider, type GeminiClientLike } from './gemini.provider';

function createConfigService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'gemini.model': 'gemini-3.5-flash-lite',
    'gemini.apiKey': 'fake-secret-key-do-not-leak',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('GeminiProvider (mocked SDK)', () => {
  it('generates response with real usage metadata and backend-configured model', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: 'Hello from mocked Gemini!',
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 9,
          },
        }),
        generateContentStream: jest.fn(),
      },
    };

    const provider = new GeminiProvider(createConfigService(), mockClient);
    const result = await provider.generate({
      systemInstruction: 'Be helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
      config: { temperature: 0.5, maxOutputTokens: 256 },
    });

    expect(mockClient.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash-lite',
        config: expect.objectContaining({
          systemInstruction: 'Be helpful.',
          temperature: 0.5,
          maxOutputTokens: 256,
        }),
      }),
    );

    expect(result.content).toBe('Hello from mocked Gemini!');
    expect(result.model).toBe('gemini-3.5-flash-lite');
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 9 });
    expect(result.finishReason).toBe('STOP');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns null token counts instead of fabricating when provider omits usageMetadata', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: 'Reply without usage',
        }),
        generateContentStream: jest.fn(),
      },
    };

    const provider = new GeminiProvider(createConfigService(), mockClient);
    const result = await provider.generate({
      systemInstruction: 'Be helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
  });

  it('throws LLM_API_KEY_MISSING when GEMINI_API_KEY is not configured', async () => {
    const provider = new GeminiProvider(
      createConfigService({ 'gemini.apiKey': undefined }),
    );

    await expect(
      provider.generate({
        systemInstruction: 'Sys',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toMatchObject({
      errorCode: 'LLM_API_KEY_MISSING',
    });
  });

  it.each([
    [
      'invalid API key',
      Object.assign(
        new Error('API_KEY_INVALID for key fake-secret-key-do-not-leak'),
        { status: 403 },
      ),
      'LLM_INVALID_API_KEY',
      HttpStatus.BAD_GATEWAY,
    ],
    [
      'free-tier quota exceeded',
      Object.assign(new Error('RESOURCE_EXHAUSTED: exceeded your current quota'), {
        status: 429,
      }),
      'LLM_QUOTA_EXCEEDED',
      HttpStatus.TOO_MANY_REQUESTS,
    ],
    [
      'rate limited',
      Object.assign(new Error('Too many requests'), { status: 429 }),
      'LLM_RATE_LIMITED',
      HttpStatus.TOO_MANY_REQUESTS,
    ],
    [
      'service unavailable',
      Object.assign(new Error('Service overloaded'), { status: 503 }),
      'LLM_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
    [
      'network error',
      new Error('fetch failed: ECONNRESET'),
      'LLM_NETWORK_ERROR',
      HttpStatus.BAD_GATEWAY,
    ],
  ])(
    'maps %s to clean LlmProviderError without leaking secrets',
    async (_label, rawError, expectedCode, expectedStatus) => {
      const mockClient: GeminiClientLike = {
        models: {
          generateContent: jest.fn().mockRejectedValue(rawError),
          generateContentStream: jest.fn(),
        },
      };

      const provider = new GeminiProvider(createConfigService(), mockClient);

      try {
        await provider.generate({
          systemInstruction: 'Sys',
          messages: [{ role: 'user', content: 'Hi' }],
        });
        fail('Expected error to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LlmProviderError);
        const llmErr = err as LlmProviderError;
        expect(llmErr.errorCode).toBe(expectedCode);
        expect(llmErr.getStatus()).toBe(expectedStatus);
        expect(JSON.stringify(llmErr.getResponse())).not.toContain(
          'fake-secret-key-do-not-leak',
        );
      }
    },
  );

  it('maps timeout to LLM_TIMEOUT', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: jest.fn(
          () => new Promise(() => undefined), // Never resolves
        ),
        generateContentStream: jest.fn(),
      },
    };

    const provider = new GeminiProvider(createConfigService(), mockClient, 30);

    await expect(
      provider.generate({
        systemInstruction: 'Sys',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toMatchObject({
      errorCode: 'LLM_TIMEOUT',
    });
  });
});
