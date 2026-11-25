import { ConfigService } from '@nestjs/config';
import { MessageRole, MessageStatus } from '@prisma/client';
import { ContextBuilder } from './context-builder';

describe('ContextBuilder', () => {
  let builder: ContextBuilder;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'chat.maxHistoryMessages') return 4;
        if (key === 'chat.maxContextChars') return 50;
        return undefined;
      }),
    } as unknown as ConfigService;
    builder = new ContextBuilder(configService);
  });

  it('filters out non-completed messages and respects maxHistoryMessages', () => {
    const result = builder.build(
      [
        { role: MessageRole.USER, content: 'm1', status: MessageStatus.COMPLETED },
        { role: MessageRole.ASSISTANT, content: 'm2', status: MessageStatus.FAILED },
        { role: MessageRole.ASSISTANT, content: 'm3', status: MessageStatus.COMPLETED },
        { role: MessageRole.USER, content: 'm4', status: MessageStatus.COMPLETED },
        { role: MessageRole.ASSISTANT, content: 'm5', status: MessageStatus.COMPLETED },
        { role: MessageRole.USER, content: 'm6', status: MessageStatus.COMPLETED },
      ],
      { maxHistoryMessages: 3, maxContextChars: 1000 },
    );

    expect(result.messages).toEqual([
      { role: 'user', content: 'm4' },
      { role: 'model', content: 'm5' },
      { role: 'user', content: 'm6' },
    ]);
    expect(result.stats.droppedCount).toBe(2);
  });

  it('drops oldest messages first when exceeding maxContextChars and always preserves newest user message', () => {
    const result = builder.build(
      [
        { role: MessageRole.USER, content: 'a'.repeat(30), status: MessageStatus.COMPLETED },
        { role: MessageRole.ASSISTANT, content: 'b'.repeat(25), status: MessageStatus.COMPLETED },
        { role: MessageRole.USER, content: 'c'.repeat(20), status: MessageStatus.COMPLETED },
      ],
      { maxHistoryMessages: 10, maxContextChars: 48 },
    );

    expect(result.messages).toEqual([
      { role: 'model', content: 'b'.repeat(25) },
      { role: 'user', content: 'c'.repeat(20) },
    ]);
    expect(result.stats.estimatedChars).toBe(45);
  });

  it('always keeps the newest message even if it exceeds maxContextChars alone', () => {
    const newest = 'x'.repeat(120);
    const result = builder.build(
      [
        { role: MessageRole.USER, content: 'old', status: MessageStatus.COMPLETED },
        { role: MessageRole.USER, content: newest, status: MessageStatus.COMPLETED },
      ],
      { maxHistoryMessages: 10, maxContextChars: 50 },
    );

    expect(result.messages).toEqual([{ role: 'user', content: newest }]);
  });
});
