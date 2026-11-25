import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversationList } from './conversation-list';

describe('ConversationList', () => {
  it('renders grouped history and triggers rename & delete callbacks', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const nowIso = new Date().toISOString();

    render(
      <ConversationList
        conversations={[
          {
            id: 'conv-1',
            title: 'Hội thoại LLM',
            createdAt: nowIso,
            updatedAt: nowIso,
            lastMessageAt: nowIso,
          },
        ]}
        activeId="conv-1"
        onRename={onRename}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Hội thoại LLM')).toBeInTheDocument();

    // Rename flow
    await user.click(screen.getByLabelText('Đổi tên Hội thoại LLM'));
    const input = screen.getByLabelText('Đổi tên hội thoại');
    await user.clear(input);
    await user.type(input, 'Hội thoại mới{Enter}');
    expect(onRename).toHaveBeenCalledWith('conv-1', 'Hội thoại mới');

    // Delete flow
    await user.click(screen.getByLabelText('Xoá Hội thoại LLM'));
    expect(onDelete).toHaveBeenCalledWith('conv-1');
  });
});
