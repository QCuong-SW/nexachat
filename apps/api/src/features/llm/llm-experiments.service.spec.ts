import { LlmProviderError } from './errors/llm-provider.error';
import {
  LlmExperimentsService,
  MAX_TOOL_ITERATIONS,
} from './llm-experiments.service';
import type { LlmService } from './llm.service';
import { ToolExecutionService } from './tools/tool-execution.service';

describe('LlmExperimentsService', () => {
  let llmService: {
    getModelId: jest.Mock;
    generateStructured: jest.Mock;
    generateWithTools: jest.Mock;
  };
  let toolExecutionService: ToolExecutionService;
  let service: LlmExperimentsService;

  beforeEach(() => {
    llmService = {
      getModelId: jest.fn().mockReturnValue('gemini-3.5-flash-lite'),
      generateStructured: jest.fn(),
      generateWithTools: jest.fn(),
    };
    toolExecutionService = new ToolExecutionService();
    service = new LlmExperimentsService(
      llmService as unknown as LlmService,
      toolExecutionService,
    );
  });

  describe('summarizeText (Structured Output)', () => {
    it('validates and returns structured summary output', async () => {
      llmService.generateStructured.mockResolvedValue({
        data: {
          title: 'Giới thiệu LLM',
          summary: 'LLM là mô hình ngôn ngữ lớn xử lý văn bản theo token.',
          keyPoints: ['Xử lý theo token', 'Không tự nhớ giữa các request'],
        },
        rawText: '{}',
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 30, outputTokens: 25 },
        finishReason: 'STOP',
        durationMs: 180,
      });

      const res = await service.summarizeText({
        text: 'Một đoạn văn bản dài hơn 10 ký tự để tóm tắt.',
      });

      expect(res.result).toEqual({
        title: 'Giới thiệu LLM',
        summary: 'LLM là mô hình ngôn ngữ lớn xử lý văn bản theo token.',
        keyPoints: ['Xử lý theo token', 'Không tự nhớ giữa các request'],
      });
    });

    it('throws LLM_INVALID_OUTPUT when model violates required schema', async () => {
      llmService.generateStructured.mockResolvedValue({
        data: {
          title: 'Thiếu keyPoints',
          summary: 'Chỉ có summary',
          keyPoints: [],
        },
        rawText: '{}',
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 20, outputTokens: 10 },
        finishReason: 'STOP',
        durationMs: 120,
      });

      await expect(
        service.summarizeText({
          text: 'Một đoạn văn bản dài hơn 10 ký tự để kiểm tra lỗi schema.',
        }),
      ).rejects.toMatchObject({
        errorCode: 'LLM_INVALID_OUTPUT',
      });
    });
  });

  describe('runToolPrompt (Function Calling)', () => {
    it('executes allowlisted tool call, sends functionResponse back, and returns final answer', async () => {
      llmService.generateWithTools
        .mockResolvedValueOnce({
          text: '',
          functionCalls: [
            { name: 'count_words', args: { text: 'Nexa Chat LLM Lab' } },
          ],
          model: 'gemini-3.5-flash-lite',
          usage: { inputTokens: 40, outputTokens: 12 },
          finishReason: 'STOP',
          durationMs: 100,
        })
        .mockResolvedValueOnce({
          text: 'Đoạn văn bản có đúng 4 từ.',
          functionCalls: [],
          model: 'gemini-3.5-flash-lite',
          usage: { inputTokens: 55, outputTokens: 14 },
          finishReason: 'STOP',
          durationMs: 110,
        });

      const res = await service.runToolPrompt({
        prompt: 'Đếm số từ trong "Nexa Chat LLM Lab"',
      });

      expect(res.iterations).toBe(2);
      expect(res.answer).toBe('Đoạn văn bản có đúng 4 từ.');
      expect(res.toolExecutions).toHaveLength(1);
      expect(res.toolExecutions[0]).toMatchObject({
        toolName: 'count_words',
        status: 'completed',
        result: { wordCount: 4, charCount: 17, lineCount: 1 },
      });
      expect(res.usage).toEqual({ inputTokens: 95, outputTokens: 26 });
    });

    it('rejects non-allowlisted tool calls safely without executing arbitrary code', async () => {
      llmService.generateWithTools
        .mockResolvedValueOnce({
          text: '',
          functionCalls: [{ name: 'eval_code', args: { code: 'process.exit(1)' } }],
          model: 'gemini-3.5-flash-lite',
          usage: { inputTokens: 30, outputTokens: 10 },
          finishReason: 'STOP',
          durationMs: 90,
        })
        .mockResolvedValueOnce({
          text: 'Tôi không có quyền chạy hàm đó.',
          functionCalls: [],
          model: 'gemini-3.5-flash-lite',
          usage: { inputTokens: 45, outputTokens: 10 },
          finishReason: 'STOP',
          durationMs: 95,
        });

      const res = await service.runToolPrompt({
        prompt: 'Chạy mã hệ thống giúp tôi',
      });

      expect(res.toolExecutions[0].status).toBe('rejected');
      expect(res.toolExecutions[0].error).toContain('not in the backend allowlist');
      expect(res.answer).toBe('Tôi không có quyền chạy hàm đó.');
    });

    it('stops infinite tool calling loops after MAX_TOOL_ITERATIONS', async () => {
      llmService.generateWithTools.mockResolvedValue({
        text: '',
        functionCalls: [{ name: 'get_current_time', args: {} }],
        model: 'gemini-3.5-flash-lite',
        usage: { inputTokens: 20, outputTokens: 5 },
        finishReason: 'STOP',
        durationMs: 50,
      });

      await expect(
        service.runToolPrompt({ prompt: 'Loop forever' }),
      ).rejects.toBeInstanceOf(LlmProviderError);
      expect(llmService.generateWithTools).toHaveBeenCalledTimes(
        MAX_TOOL_ITERATIONS,
      );
    });
  });
});
