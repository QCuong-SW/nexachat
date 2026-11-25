import { apiRequest } from '@/lib/api-client';

export interface SummarizeApiResponse {
  result: {
    title: string;
    summary: string;
    keyPoints: string[];
  };
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
  durationMs: number;
}

export interface ToolExecutionTrace {
  toolName: string;
  args: Record<string, unknown>;
  status: 'completed' | 'rejected';
  result?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface RunToolsApiResponse {
  answer: string;
  toolExecutions: ToolExecutionTrace[];
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
  iterations: number;
  durationMs: number;
}

export const llmLabsApi = {
  summarize: (text: string) =>
    apiRequest<SummarizeApiResponse>('/llm/summarize', {
      method: 'POST',
      body: { text },
    }),

  runTools: (prompt: string) =>
    apiRequest<RunToolsApiResponse>('/llm/tools/run', {
      method: 'POST',
      body: { prompt },
    }),
};
