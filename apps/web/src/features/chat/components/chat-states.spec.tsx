import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyChatState } from './empty-chat-state';
import { MessageList } from './message-list';

describe('Chat UI states', () => {
  it('renders empty state prompt suggestions and handles selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EmptyChatState onSelectPrompt={onSelect} />);

    const suggestionBtn = screen.getByRole('button', {
      name: /Hiểu về Context Window/i,
    });
    await user.click(suggestionBtn);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toContain('Context Window');
  });

  it('renders loading state', () => {
    render(<MessageList messages={[]} isLoading />);
    expect(
      screen.getByText(/Đang tải lịch sử hội thoại/i),
    ).toBeInTheDocument();
  });

  it('renders error state with retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <MessageList
        messages={[]}
        errorMessage="Hạn mức Gemini Free Tier tạm thời đã hết."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hạn mức Gemini Free Tier tạm thời đã hết.',
    );
    await user.click(screen.getByRole('button', { name: /Thử lại/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
