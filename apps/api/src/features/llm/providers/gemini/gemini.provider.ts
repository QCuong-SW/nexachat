import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProviderError,
  mapGeminiError,
} from '../../errors/llm-provider.error';
import type {
  ILlmProvider,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmGenerationConfig,
  LlmStreamChunk,
  LlmStructuredRequest,
  LlmStructuredResponse,
  LlmToolCall,
  LlmToolGenerateRequest,
  LlmToolGenerateResponse,
  LlmUsage,
} from '../../interfaces/llm-provider.interface';

export interface GeminiClientLike {
  models: {
    generateContent(params: Record<string, unknown>): Promise<GeminiResponseLike>;
    generateContentStream(
      params: Record<string, unknown>,
    ): Promise<AsyncIterable<GeminiResponseLike>>;
  };
}

export interface GeminiResponseLike {
  text?: string;
  functionCalls?: Array<{
    name?: string;
    args?: Record<string, unknown>;
  }>;
  candidates?: Array<{
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Adapter chính thức cho Gemini Developer API Free Tier dùng SDK `@google/genai`.
 *
 * Quy tắc bắt buộc:
 * - Model ID lấy từ backend configuration (`GEMINI_MODEL`), không lấy từ input của người dùng.
 * - Không tự động fallback sang model trả phí.
 * - Không dùng Google Search grounding hay tính năng trả phí.
 * - Không log `GEMINI_API_KEY` hay nội dung hội thoại nhạy cảm.
 */
@Injectable()
export class GeminiProvider implements ILlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly modelId: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private clientInstance: GeminiClientLike | null;

  constructor(
    configService: ConfigService,
    injectedClient?: GeminiClientLike,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.modelId = (
      configService.get<string>('gemini.model') ?? 'gemini-3.5-flash-lite'
    ).trim();
    const rawKey = configService.get<string>('gemini.apiKey')?.trim();
    this.apiKey =
      rawKey && rawKey !== 'your_gemini_api_key_here' ? rawKey : undefined;
    this.clientInstance = injectedClient ?? null;
    this.timeoutMs = timeoutMs;
  }

  getModelId(): string {
    return this.modelId;
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const client = this.getClient();
    const startedAt = Date.now();

    try {
      const response = await this.withTimeout(
        client.models.generateContent({
          model: this.modelId,
          contents: this.toGeminiContents(request.messages),
          config: this.buildGenerationConfig(
            request.systemInstruction,
            request.config,
          ),
        }),
      );

      const durationMs = Date.now() - startedAt;
      const content = response.text ?? '';
      const usage = this.extractUsage(response.usageMetadata);
      const finishReason = response.candidates?.[0]?.finishReason ?? null;

      return {
        content,
        model: this.modelId,
        usage,
        finishReason,
        durationMs,
      };
    } catch (error) {
      const mapped = mapGeminiError(error);
      this.logger.warn(
        `Gemini generate failed with code=${mapped.errorCode} model=${this.modelId}`,
      );
      throw mapped;
    }
  }

  async *generateStream(
    request: LlmGenerateRequest,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    const client = this.getClient();

    try {
      const stream = await this.withTimeout(
        client.models.generateContentStream({
          model: this.modelId,
          contents: this.toGeminiContents(request.messages),
          config: {
            ...this.buildGenerationConfig(
              request.systemInstruction,
              request.config,
            ),
            ...(signal ? { abortSignal: signal } : {}),
          },
        }),
        signal,
      );

      let lastUsage: LlmUsage = { inputTokens: null, outputTokens: null };
      let lastFinishReason: string | null = null;

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new LlmProviderError(
            'LLM_CANCELLED',
            'Yêu cầu sinh phản hồi đã bị huỷ.',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (chunk.usageMetadata) {
          lastUsage = this.extractUsage(chunk.usageMetadata);
        }
        if (chunk.candidates?.[0]?.finishReason) {
          lastFinishReason = chunk.candidates[0].finishReason;
        }

        const delta = chunk.text ?? '';
        if (delta.length > 0) {
          yield {
            type: 'delta',
            delta,
            model: this.modelId,
          };
        }
      }

      yield {
        type: 'done',
        model: this.modelId,
        usage: lastUsage,
        finishReason: lastFinishReason,
      };
    } catch (error) {
      const mapped = mapGeminiError(error);
      this.logger.warn(
        `Gemini stream failed with code=${mapped.errorCode} model=${this.modelId}`,
      );
      throw mapped;
    }
  }

  async generateStructured<T = unknown>(
    request: LlmStructuredRequest,
  ): Promise<LlmStructuredResponse<T>> {
    const client = this.getClient();
    const startedAt = Date.now();

    try {
      const response = await this.withTimeout(
        client.models.generateContent({
          model: this.modelId,
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          config: {
            ...this.buildGenerationConfig(
              request.systemInstruction,
              request.config,
            ),
            responseMimeType: 'application/json',
            responseJsonSchema: request.responseJsonSchema,
          },
        }),
      );

      const durationMs = Date.now() - startedAt;
      const rawText = response.text ?? '';

      let parsed: T;
      try {
        parsed = JSON.parse(rawText) as T;
      } catch {
        throw new LlmProviderError(
          'LLM_INVALID_OUTPUT',
          'Mô hình trả về dữ liệu không đúng định dạng JSON hợp lệ.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        data: parsed,
        rawText,
        model: this.modelId,
        usage: this.extractUsage(response.usageMetadata),
        finishReason: response.candidates?.[0]?.finishReason ?? null,
        durationMs,
      };
    } catch (error) {
      const mapped = mapGeminiError(error);
      this.logger.warn(
        `Gemini structured generation failed with code=${mapped.errorCode}`,
      );
      throw mapped;
    }
  }

  async generateWithTools(
    request: LlmToolGenerateRequest,
  ): Promise<LlmToolGenerateResponse> {
    const client = this.getClient();
    const startedAt = Date.now();

    const contents: Content[] = request.turns.map((turn) => {
      const parts: Part[] = [];
      if (turn.text) {
        parts.push({ text: turn.text });
      }
      if (turn.functionCalls) {
        for (const call of turn.functionCalls) {
          parts.push({
            functionCall: {
              name: call.name,
              args: call.args,
            },
          });
        }
      }
      if (turn.functionResponses) {
        for (const fnRes of turn.functionResponses) {
          parts.push({
            functionResponse: {
              name: fnRes.name,
              response: fnRes.response,
            },
          });
        }
      }
      return { role: turn.role, parts };
    });

    try {
      const response = await this.withTimeout(
        client.models.generateContent({
          model: this.modelId,
          contents,
          config: {
            ...this.buildGenerationConfig(
              request.systemInstruction,
              request.config,
            ),
            tools: [
              {
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parametersJsonSchema: tool.parametersJsonSchema,
                })),
              },
            ],
          },
        }),
      );

      const durationMs = Date.now() - startedAt;
      const functionCalls: LlmToolCall[] = (response.functionCalls ?? [])
        .filter((call): call is { name: string; args?: Record<string, unknown> } =>
          typeof call.name === 'string' && call.name.length > 0,
        )
        .map((call) => ({
          name: call.name,
          args:
            call.args && typeof call.args === 'object' ? call.args : {},
        }));

      return {
        text: response.text ?? '',
        functionCalls,
        model: this.modelId,
        usage: this.extractUsage(response.usageMetadata),
        finishReason: response.candidates?.[0]?.finishReason ?? null,
        durationMs,
      };
    } catch (error) {
      const mapped = mapGeminiError(error);
      this.logger.warn(
        `Gemini tool generation failed with code=${mapped.errorCode}`,
      );
      throw mapped;
    }
  }

  private getClient(): GeminiClientLike {
    if (this.clientInstance) {
      return this.clientInstance;
    }

    if (!this.apiKey) {
      throw new LlmProviderError(
        'LLM_API_KEY_MISSING',
        'Máy chủ chưa cấu hình GEMINI_API_KEY. Hãy thêm key Free Tier vào .env của backend.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.clientInstance = new GoogleGenAI({
      apiKey: this.apiKey,
    }) as unknown as GeminiClientLike;
    return this.clientInstance;
  }

  private toGeminiContents(messages: LlmGenerateRequest['messages']): Content[] {
    return messages.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
  }

  private buildGenerationConfig(
    systemInstruction: string,
    config?: LlmGenerationConfig,
  ): Record<string, unknown> {
    return {
      systemInstruction,
      ...(config?.temperature !== undefined
        ? { temperature: config.temperature }
        : {}),
      ...(config?.maxOutputTokens !== undefined
        ? { maxOutputTokens: config.maxOutputTokens }
        : {}),
    };
  }

  private extractUsage(
    usage?: GeminiResponseLike['usageMetadata'],
  ): LlmUsage {
    return {
      inputTokens:
        typeof usage?.promptTokenCount === 'number'
          ? usage.promptTokenCount
          : null,
      outputTokens:
        typeof usage?.candidatesTokenCount === 'number'
          ? usage.candidatesTokenCount
          : null,
    };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    if (externalSignal?.aborted) {
      throw new LlmProviderError(
        'LLM_CANCELLED',
        'Yêu cầu sinh phản hồi đã bị huỷ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const err = new Error('Gemini API request timed out');
        err.name = 'TimeoutError';
        reject(err);
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
