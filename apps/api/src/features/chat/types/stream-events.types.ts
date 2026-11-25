export type ChatStreamEventName =
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'message.error';

export interface MessageStartedEventData {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  model: string;
  conversationTitle?: string;
}

export interface MessageDeltaEventData {
  assistantMessageId: string;
  delta: string;
}

export interface MessageCompletedEventData {
  assistantMessageId: string;
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  finishReason: string | null;
  durationMs: number;
}

export interface MessageErrorEventData {
  assistantMessageId?: string;
  code: string;
  message: string;
}

export type ChatStreamEvent =
  | { event: 'message.started'; data: MessageStartedEventData }
  | { event: 'message.delta'; data: MessageDeltaEventData }
  | { event: 'message.completed'; data: MessageCompletedEventData }
  | { event: 'message.error'; data: MessageErrorEventData };

export function formatSseEvent(event: ChatStreamEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
