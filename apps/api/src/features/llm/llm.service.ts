import { Inject, Injectable } from '@nestjs/common';
import {
  LLM_PROVIDER,
  type ILlmProvider,
  type LlmGenerateResponse,
  type LlmGenerationConfig,
  type LlmMessage,
  type LlmStreamChunk,
  type LlmStructuredRequest,
  type LlmStructuredResponse,
  type LlmToolGenerateRequest,
  type LlmToolGenerateResponse,
} from './interfaces/llm-provider.interface';
import { buildSystemPrompt } from './prompts/system-prompt';

@Injectable()
export class LlmService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: ILlmProvider,
  ) {}

  getModelId(): string {
    return this.provider.getModelId();
  }

  async generateChatReply(
    messages: LlmMessage[],
    config?: LlmGenerationConfig,
  ): Promise<LlmGenerateResponse> {
    return this.provider.generate({
      systemInstruction: buildSystemPrompt(),
      messages,
      config,
    });
  }

  streamChatReply(
    messages: LlmMessage[],
    config?: LlmGenerationConfig,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    return this.provider.generateStream(
      {
        systemInstruction: buildSystemPrompt(),
        messages,
        config,
      },
      signal,
    );
  }

  async generateStructured<T = unknown>(
    request: Omit<LlmStructuredRequest, 'systemInstruction'> & {
      systemInstruction?: string;
    },
  ): Promise<LlmStructuredResponse<T>> {
    return this.provider.generateStructured<T>({
      ...request,
      systemInstruction: request.systemInstruction ?? buildSystemPrompt(),
    });
  }

  async generateWithTools(
    request: Omit<LlmToolGenerateRequest, 'systemInstruction'> & {
      systemInstruction?: string;
    },
  ): Promise<LlmToolGenerateResponse> {
    return this.provider.generateWithTools({
      ...request,
      systemInstruction: request.systemInstruction ?? buildSystemPrompt(),
    });
  }
}
