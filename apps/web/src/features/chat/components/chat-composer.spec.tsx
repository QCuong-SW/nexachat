import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from './chat-composer';

describe('ChatComposer', () => {
  it('sends message on Enter and clears input', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);

    const textarea = screen.getByLabelText('Nhập tin nhắn');
    await user.type(textarea, 'Xin chào Nexa{Enter}');

    expect(onSend).toHaveBeenCalledWith('Xin chào Nexa');
    expect(textarea).toHaveValue('');
  });

  it('inserts newline on Shift+Enter without sending', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);

    const textarea = screen.getByLabelText('Nhập tin nhắn');
    await user.type(textarea, 'Dòng 1{Shift>}{Enter}{/Shift}Dòng 2');

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Dòng 1\nDòng 2');
  });

  it('blocks sending and displays feedback when exceeding maxLength', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} maxLength={10} />);

    const textarea = screen.getByLabelText('Nhập tin nhắn');
    await user.type(textarea, '12345678901');

    expect(
      screen.getByText(/Đã vượt quá giới hạn độ dài tin nhắn/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi/i })).toBeDisabled();
  });

  it('renders Stop button during streaming and triggers onStop', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<ChatComposer onSend={vi.fn()} onStop={onStop} isStreaming />);

    const stopBtn = screen.getByRole('button', { name: /Dừng/i });
    await user.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
