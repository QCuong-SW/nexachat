import { describe, expect, it } from 'vitest';
import { parseSseBuffer } from './chat-stream-api';

describe('parseSseBuffer', () => {
  it('parses multiple complete SSE frames and preserves incomplete remainder', () => {
    const chunk1 =
      'event: message.started\ndata: {"conversationId":"c1","userMessageId":"u1","assistantMessageId":"a1","model":"gemini-3.5-flash-lite"}\n\n' +
      'event: message.delta\ndata: {"assistantMessageId":"a1","delta":"Xin "}\n\n' +
      'event: message.delta\ndata: {"assistantMessageId":"a1"';

    const first = parseSseBuffer(chunk1);
    expect(first.events).toHaveLength(2);
    expect(first.events[0].event).toBe('message.started');
    expect(first.events[1]).toEqual({
      event: 'message.delta',
      data: { assistantMessageId: 'a1', delta: 'Xin ' },
    });
    expect(first.remainder).toContain('event: message.delta');

    const chunk2 = `${first.remainder},"delta":"chào"}\n\n`;
    const second = parseSseBuffer(chunk2);
    expect(second.events).toEqual([
      {
        event: 'message.delta',
        data: { assistantMessageId: 'a1', delta: 'chào' },
      },
    ]);
    expect(second.remainder).toBe('');
  });
});
