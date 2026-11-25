import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { llmLabsApi } from '../api/labs-api';
import { LlmLabsPanel } from './llm-labs-panel';

describe('LlmLabsPanel', () => {
  it('renders structured summary result from backend', async () => {
    const user = userEvent.setup();
    vi.spyOn(llmLabsApi, 'summarize').mockResolvedValue({
      result: {
        title: 'Tổng quan Nexa Chat',
        summary: 'Ứng dụng học LLM Engineering với NestJS và Next.js.',
        keyPoints: ['Structured Output', 'Function Calling an toàn'],
      },
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 20, outputTokens: 15 },
      durationMs: 110,
    });

    render(<LlmLabsPanel />);
    await user.type(
      screen.getByLabelText('Văn bản cần tóm tắt'),
      'Đây là đoạn văn bản mẫu dài hơn mười ký tự.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Tạo tóm tắt có cấu trúc' }),
    );

    expect(await screen.findByText('Tổng quan Nexa Chat')).toBeInTheDocument();
    expect(screen.getByText('Structured Output')).toBeInTheDocument();
  });

  it('displays tool execution status badges and final answer for Function Calling', async () => {
    const user = userEvent.setup();
    vi.spyOn(llmLabsApi, 'runTools').mockResolvedValue({
      answer: 'Hiện tại là 11:30 theo giờ Việt Nam.',
      toolExecutions: [
        {
          toolName: 'get_current_time',
          args: { timezone: 'Asia/Ho_Chi_Minh' },
          status: 'completed',
          result: { timezone: 'Asia/Ho_Chi_Minh', iso: '2026-11-23T04:30:00Z' },
          durationMs: 2,
        },
      ],
      model: 'gemini-3.5-flash-lite',
      usage: { inputTokens: 45, outputTokens: 20 },
      iterations: 2,
      durationMs: 240,
    });

    render(<LlmLabsPanel />);
    await user.type(
      screen.getByLabelText('Prompt thử nghiệm Function Calling'),
      'Mấy giờ rồi?',
    );
    await user.click(
      screen.getByRole('button', { name: 'Chạy Function Calling' }),
    );

    expect(await screen.findByText('Đã thực thi')).toBeInTheDocument();
    expect(screen.getAllByText('get_current_time').length).toBeGreaterThanOrEqual(
      2,
    );
    expect(
      screen.getByText('Hiện tại là 11:30 theo giờ Việt Nam.'),
    ).toBeInTheDocument();
  });
});
