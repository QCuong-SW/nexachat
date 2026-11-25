export type MessageRole = 'USER' | 'ASSISTANT';
export type MessageStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  finishReason?: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}
