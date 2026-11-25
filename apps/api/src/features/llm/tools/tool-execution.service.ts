import { Injectable } from '@nestjs/common';
import type { LlmToolDeclaration } from '../interfaces/llm-provider.interface';

export type AllowlistedToolName = 'get_current_time' | 'count_words';

export interface ToolExecutionRecord {
  toolName: string;
  args: Record<string, unknown>;
  status: 'completed' | 'rejected';
  result?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

type ToolHandler = (args: Record<string, unknown>) => Record<string, unknown>;

const MAX_COUNT_WORDS_TEXT_LENGTH = 20_000;

/**
 * Dịch vụ thực thi Function Calling an toàn:
 * - CHỈ thực thi các hàm nằm trong danh sách allowlist tường minh (`get_current_time`, `count_words`).
 * - Validate tên hàm và kiểu tham số nghiêm ngặt trước khi chạy.
 * - KHÔNG dùng eval, KHÔNG chạy mã sinh động, KHÔNG truy cập DB tự do.
 */
@Injectable()
export class ToolExecutionService {
  private readonly declarations: LlmToolDeclaration[] = [
    {
      name: 'get_current_time',
      description:
        'Get the current date and time on the server, optionally formatted for a valid IANA timezone such as "UTC" or "Asia/Ho_Chi_Minh".',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description:
              'Optional IANA timezone identifier (e.g. "UTC", "Asia/Ho_Chi_Minh"). Defaults to "UTC".',
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'count_words',
      description:
        'Count words, characters, and lines in a given plain text string.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to count words in.',
          },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  ];

  private readonly allowlist: ReadonlyMap<AllowlistedToolName, ToolHandler> =
    new Map<AllowlistedToolName, ToolHandler>([
      ['get_current_time', (args) => this.executeGetCurrentTime(args)],
      ['count_words', (args) => this.executeCountWords(args)],
    ]);

  getToolDeclarations(): LlmToolDeclaration[] {
    return this.declarations;
  }

  isAllowlisted(toolName: string): toolName is AllowlistedToolName {
    return this.allowlist.has(toolName as AllowlistedToolName);
  }

  execute(
    toolName: string,
    rawArgs: Record<string, unknown>,
  ): ToolExecutionRecord {
    const startedAt = Date.now();
    const args =
      rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
        ? rawArgs
        : {};

    if (!this.isAllowlisted(toolName)) {
      return {
        toolName,
        args,
        status: 'rejected',
        error: `Tool "${toolName}" is not in the backend allowlist.`,
        durationMs: Date.now() - startedAt,
      };
    }

    const handler = this.allowlist.get(toolName)!;
    try {
      const result = handler(args);
      return {
        toolName,
        args,
        status: 'completed',
        result,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid tool arguments.';
      return {
        toolName,
        args,
        status: 'rejected',
        error: message,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  private executeGetCurrentTime(
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const allowedKeys = new Set(['timezone']);
    for (const key of Object.keys(args)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Unexpected argument "${key}" for get_current_time.`);
      }
    }

    let timezone = 'UTC';
    if (args.timezone !== undefined) {
      if (typeof args.timezone !== 'string' || args.timezone.trim().length === 0) {
        throw new Error('Argument "timezone" must be a non-empty string.');
      }
      timezone = args.timezone.trim();
    }

    const now = new Date();
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      }).format(now);
    } catch {
      throw new Error(`Invalid IANA timezone "${timezone}".`);
    }

    return {
      iso: now.toISOString(),
      timezone,
      formatted,
    };
  }

  private executeCountWords(
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const allowedKeys = new Set(['text']);
    for (const key of Object.keys(args)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Unexpected argument "${key}" for count_words.`);
      }
    }

    if (typeof args.text !== 'string') {
      throw new Error('Argument "text" must be a string.');
    }
    if (args.text.length > MAX_COUNT_WORDS_TEXT_LENGTH) {
      throw new Error(
        `Argument "text" exceeds maximum length of ${MAX_COUNT_WORDS_TEXT_LENGTH} characters.`,
      );
    }

    const trimmed = args.text.trim();
    const words = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
    const lines = args.text.length === 0 ? 0 : args.text.split(/\r?\n/).length;

    return {
      wordCount: words.length,
      charCount: args.text.length,
      lineCount: lines,
    };
  }
}
