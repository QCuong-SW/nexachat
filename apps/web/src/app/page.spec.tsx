import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import HomePage from './page';

describe('HomePage', () => {
  it('redirects root path to /chat', () => {
    HomePage();
    expect(redirectMock).toHaveBeenCalledWith('/chat');
  });
});
