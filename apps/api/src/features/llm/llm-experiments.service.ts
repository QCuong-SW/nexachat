import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  RunToolsPromptDto,
  SummarizeTextDto,
  SummaryOutputDto,
} from './dto/experiments.dto';
import { LlmProviderError } from './errors/llm-provider.error';
import type {
  LlmToolTurn,
  LlmUsage,
} from './interfaces/llm-provider.interface';
import { LlmService } from './llm.service';
import {
  ToolExecutionService,
  type ToolExecutionRecord,
} from './tools/tool-execution.service';

export const SUMMARY_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'A concise title summarizing the text.',
    },
    summary: {
      type: 'string',
      description: 'A clear 2-4 sentence summary of the provided text.',
    },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 8,
      description: 'Bullet list of the most important takeaways.',
    },
  },
  required: ['title', 'summary', 'keyPoints'],
  additionalProperties: false,
};

export const MAX_TOOL_ITERATIONS = 3;

export interface SummarizeResult {
  result: SummaryOutputDto;
  model: string;
  usage: LlmUsage;
  durationMs: number;
}

export interface ToolRunResult {
  answer: string;
  toolExecutions: ToolExecutionRecord[];
  model: string;
  usage: LlmUsage;
  iterations: number;
  durationMs: number;
}

@Injectable()
export class LlmExperimentsService {
  constructor(
    private readonly llmService: LlmService,
    private readonly toolExecutionService: ToolExecutionService,
  ) {}

  /**
   * 6A. Structured Output: yêu cầu Gemini trả JSON theo schema rồi validate lại
   * ở backend bằng class-validator trước khi trả về client.
   */
  async summarizeText(dto: SummarizeTextDto): Promise<SummarizeResult> {
    const response = await this.llmService.generateStructured<unknown>({
      systemInstruction:
        'You are a precise summarization assistant. Return strictly valid JSON matching the requested schema in the same language as the input text.',
      prompt: `Hãy tóm tắt đoạn văn bản sau và trích xuất các ý chính:\n\n${dto.text}`,
      responseJsonSchema: SUMMARY_RESPONSE_JSON_SCHEMA,
      config: dto.config,
    });

    if (!response.data || typeof response.data !== 'object') {
      throw new LlmProviderError(
        'LLM_INVALID_OUTPUT',
        'Dữ liệu JSON từ mô hình không đúng cấu trúc yêu cầu.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const validated = plainToInstance(SummaryOutputDto, response.data);
    const errors = validateSync(validated, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      throw new LlmProviderError(
        'LLM_INVALID_OUTPUT',
        'Mô hình trả về dữ liệu không đạt kiểm tra schema (title, summary, keyPoints).',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      result: {
        title: validated.title.trim(),
        summary: validated.summary.trim(),
        keyPoints: validated.keyPoints.map((p) => p.trim()),
      },
      model: response.model,
      usage: response.usage,
      durationMs: response.durationMs,
    };
  }

  /**
   * 6B. Function Calling an toàn:
   * 1. Đăng ký allowlisted tools với Gemini.
   * 2. Nếu model yêu cầu gọi hàm -> validate & chạy qua ToolExecutionService.
   * 3. Gửi functionResponse ngược lại cho Gemini tiếp tục sinh câu trả lời cuối.
   * 4. Giới hạn tối đa MAX_TOOL_ITERATIONS vòng để tránh lặp vô hạn.
   */
  async runToolPrompt(dto: RunToolsPromptDto): Promise<ToolRunResult> {
    const startedAt = Date.now();
    const tools = this.toolExecutionService.getToolDeclarations();
    const turns: LlmToolTurn[] = [{ role: 'user', text: dto.prompt }];
    const toolExecutions: ToolExecutionRecord[] = [];

    let totalInputTokens: number | null = null;
    let totalOutputTokens: number | null = null;
    let modelId = this.llmService.getModelId();

    const addUsage = (usage: LlmUsage) => {
      if (typeof usage.inputTokens === 'number') {
        totalInputTokens = (totalInputTokens ?? 0) + usage.inputTokens;
      }
      if (typeof usage.outputTokens === 'number') {
        totalOutputTokens = (totalOutputTokens ?? 0) + usage.outputTokens;
      }
    };

    for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await this.llmService.generateWithTools({
        systemInstruction:
          'You are a helpful assistant with access to safe utility tools (get_current_time, count_words). Use tools when helpful and answer clearly in the user language.',
        turns,
        tools,
        config: dto.config,
      });

      modelId = response.model;
      addUsage(response.usage);

      if (response.functionCalls.length === 0) {
        return {
          answer: response.text,
          toolExecutions,
          model: modelId,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          },
          iterations: iteration,
          durationMs: Date.now() - startedAt,
        };
      }

      // Ghi lượt model gọi hàm
      turns.push({
        role: 'model',
        functionCalls: response.functionCalls,
      });

      // Thực thi an toàn qua allowlist và trả kết quả lại cho Gemini
      const functionResponses: Array<{
        name: string;
        response: Record<string, unknown>;
      }> = [];

      for (const call of response.functionCalls) {
        const record = this.toolExecutionService.execute(call.name, call.args);
        toolExecutions.push(record);
        functionResponses.push({
          name: call.name,
          response:
            record.status === 'completed'
              ? { ok: true, ...(record.result ?? {}) }
              : { ok: false, error: record.error ?? 'Tool execution rejected.' },
        });
      }

      turns.push({
        role: 'user',
        functionResponses,
      });
    }

    throw new LlmProviderError(
      'LLM_INVALID_OUTPUT',
      `Mô hình vượt quá giới hạn tối đa ${MAX_TOOL_ITERATIONS} vòng gọi hàm.`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
