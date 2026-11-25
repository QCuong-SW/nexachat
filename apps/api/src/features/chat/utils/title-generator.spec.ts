import { generateDeterministicTitle } from './title-generator';

describe('generateDeterministicTitle', () => {
  it('returns default title for blank text', () => {
    expect(generateDeterministicTitle('   \n\t  ')).toBe('Cuộc trò chuyện mới');
  });

  it('normalizes whitespace and keeps short text intact', () => {
    expect(generateDeterministicTitle('  Hello\n\n  world  ')).toBe(
      'Hello world',
    );
  });

  it('truncates long prompts cleanly around word boundaries with ellipsis', () => {
    const title = generateDeterministicTitle(
      'Giải thích sự khác biệt giữa Streaming SSE và REST thông thường trong chatbot LLM',
      40,
    );
    expect(title.endsWith('...')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(43);
  });
});
