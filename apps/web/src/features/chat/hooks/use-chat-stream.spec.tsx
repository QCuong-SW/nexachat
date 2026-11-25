import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import * as streamApi from '../api/chat-stream-api';
import { useChatStream } from './use-chat-stream';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useChatStream', () => {
  it('accumulates streamed deltas and exposes live streaming state', async () => {
    let releaseStream!: () => void;
    vi.spyOn(streamApi, 'streamConversationMessage').mockImplementation(
      async (_convId, _payload, options) => {
        options.onEvent({
          event: 'message.started',
          data: {
            conversationId: 'conv-1',
            userMessageId: 'u-1',
            assistantMessageId: 'a-1',
            model: 'gemini-3.5-flash-lite',
          },
        });
        options.onEvent({
          event: 'message.delta',
          data: { assistantMessageId: 'a-1', delta: 'Hello ' },
        });
        options.onEvent({
          event: 'message.delta',
          data: { assistantMessageId: 'a-1', delta: 'world!' },
        });
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
        options.onEvent({
          event: 'message.completed',
          data: {
            assistantMessageId: 'a-1',
            content: 'Hello world!',
            model: 'gemini-3.5-flash-lite',
            inputTokens: 10,
            outputTokens: 5,
            finishReason: 'STOP',
            durationMs: 120,
          },
        });
      },
    );

    const { result } = renderHook(() => useChatStream(), {
      wrapper: createWrapper(),
    });

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage('conv-1', 'Say hi');
    });

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.optimisticMessages[1]?.content).toBe('Hello world!');

    await act(async () => {
      releaseStream();
      await sendPromise;
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('sets clean error message when quota 429 error occurs', async () => {
    vi.spyOn(streamApi, 'streamConversationMessage').mockRejectedValue(
      new ApiError(
        429,
        'LLM_QUOTA_EXCEEDED',
        'Hạn mức Gemini Free Tier đã đạt giới hạn.',
      ),
    );

    const { result } = renderHook(() => useChatStream(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage('conv-1', 'Trigger quota');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.errorMessage).toContain('Hạn mức Gemini Free Tier');
  });
});
