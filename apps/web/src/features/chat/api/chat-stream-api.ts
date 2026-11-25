import { ApiError, type ApiErrorPayload } from '@/lib/api-client';
import { env } from '@/lib/env';

export interface MessageStartedPayload {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  model: string;
  conversationTitle?: string;
}

export interface MessageDeltaPayload {
  assistantMessageId: string;
  delta: string;
}

export interface MessageCompletedPayload {
  assistantMessageId: string;
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  finishReason: string | null;
  durationMs: number;
}

export interface MessageErrorPayload {
  assistantMessageId?: string;
  code: string;
  message: string;
}

export type ChatStreamEvent =
  | { event: 'message.started'; data: MessageStartedPayload }
  | { event: 'message.delta'; data: MessageDeltaPayload }
  | { event: 'message.completed'; data: MessageCompletedPayload }
  | { event: 'message.error'; data: MessageErrorPayload };

/**
 * Tách các frame SSE hoàn chỉnh (ngăn cách bởi dòng trống) ra khỏi buffer đang stream.
 * Trả về danh sách event đã parse và phần remainder chưa hoàn chỉnh cho chunk kế tiếp.
 */
export function parseSseBuffer(buffer: string): {
  events: ChatStreamEvent[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const remainder = frames.pop() ?? '';
  const events: ChatStreamEvent[] = [];

  for (const frame of frames) {
    if (!frame.trim()) continue;
    let eventName = '';
    const dataLines: string[] = [];

    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!eventName || dataLines.length === 0) continue;

    try {
      const parsedData = JSON.parse(dataLines.join('\n')) as unknown;
      if (
        eventName === 'message.started' ||
        eventName === 'message.delta' ||
        eventName === 'message.completed' ||
        eventName === 'message.error'
      ) {
        events.push({
          event: eventName,
          data: parsedData,
        } as ChatStreamEvent);
      }
    } catch {
      // Bỏ qua frame JSON lỗi nếu có
    }
  }

  return { events, remainder };
}

export interface StreamMessageOptions {
  signal?: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}

export async function streamConversationMessage(
  conversationId: string,
  payload: {
    content: string;
    config?: { temperature?: number; maxOutputTokens?: number };
  },
  options: StreamMessageOptions,
): Promise<void> {
  const url = `${env.NEXT_PUBLIC_API_BASE_URL}/conversations/${conversationId}/messages/stream`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Không thể kết nối tới máy chủ API. Hãy kiểm tra mạng và backend.',
    );
  }

  if (!response.ok) {
    let payloadErr: ApiErrorPayload = {};
    try {
      payloadErr = (await response.json()) as ApiErrorPayload;
    } catch {
      // Ignore parse failure
    }
    throw new ApiError(
      response.status,
      payloadErr.error?.code ?? 'HTTP_ERROR',
      payloadErr.error?.message ?? `Yêu cầu thất bại (${response.status})`,
      payloadErr.error?.details,
    );
  }

  if (!response.body) {
    throw new ApiError(
      502,
      'STREAM_UNSUPPORTED',
      'Trình duyệt không hỗ trợ đọc dữ liệu stream.',
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        const { events } = parseSseBuffer(`${buffer}\n\n`);
        for (const ev of events) {
          options.onEvent(ev);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseBuffer(buffer);
      buffer = remainder;
      for (const ev of events) {
        options.onEvent(ev);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
