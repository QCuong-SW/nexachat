// note
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
// pick role to answer or ask
export type LlmRole = 'user' | 'model';

// trả lời gồm role, nội dung 
export interface LlmMessage {
  role: LlmRole;
  content: string;
}

// config khi trả lời
export interface LlmGenerationConfig {
  // độ đa dạng từ (random)
  temperature?: number;
  // token max khi trả lời
  maxOutputTokens?: number;
}

// ghi nhận mức sử dụng thực tế
export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

// đầu vào
export interface LlmGenerateRequest {
  // system prompting
  systemInstruction: string;
  // hội thoại ngữ cảnh
  messages: LlmMessage[];
  // config cho model
  config?: LlmGenerationConfig;
}

// ra
export interface LlmGenerateResponse {
  content: string;
  model: string;
  usage: LlmUsage;
  // lý do ngắt
  finishReason: string | null;
  durationMs: number;
}

// gửi từng stream 
export interface LlmStreamChunk {
  type: 'delta' | 'done';
  delta?: string;
  model?: string;
  usage?: LlmUsage;
  finishReason?: string | null;
}
// req structure json schema
export interface LlmStructuredRequest {
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
  config?: LlmGenerationConfig;
}

// res
export interface LlmStructuredResponse<T = unknown> {
  data: T;
  rawText: string;
  model: string;
  usage: LlmUsage;
  finishReason: string | null;
  durationMs: number;
}

// tools & call tools
export interface LlmToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}
export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
}

// ghi câu trả lời có gọi tools
export interface LlmToolTurn {
  role: 'user' | 'model';
  text?: string;
  functionCalls?: LlmToolCall[];
  functionResponses?: Array<{
    name: string;
    response: Record<string, unknown>;
  }>;
}

// res.req riêng cho answer call tools
export interface LlmToolGenerateRequest {
  systemInstruction: string;
  turns: LlmToolTurn[];
  tools: LlmToolDeclaration[];
  config?: LlmGenerationConfig;
}
export interface LlmToolGenerateResponse {
  text: string;
  functionCalls: LlmToolCall[];
  model: string;
  usage: LlmUsage;
  finishReason: string | null;
  durationMs: number;
}

// interface summary
export interface ILlmProvider {
  getModelId(): string;
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
  generateStream(
    request: LlmGenerateRequest,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk>;
  generateStructured<T = unknown>(
    request: LlmStructuredRequest,
  ): Promise<LlmStructuredResponse<T>>;
  generateWithTools(
    request: LlmToolGenerateRequest,
  ): Promise<LlmToolGenerateResponse>;
}
