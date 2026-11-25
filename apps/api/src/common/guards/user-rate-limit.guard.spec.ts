import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRateLimitGuard } from './user-rate-limit.guard';

function createContext(userId: string) {
  const setHeader = jest.fn();
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId }, ip: '127.0.0.1' }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { ctx, setHeader };
}

describe('UserRateLimitGuard', () => {
  it('enforces per-user request limits and sets Retry-After on 429', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'rateLimit.ttlMs') return 60_000;
        if (key === 'rateLimit.maxRequests') return 2;
        return undefined;
      }),
    } as unknown as ConfigService;

    const guard = new UserRateLimitGuard(configService);
    const userA = createContext('user-a');
    const userB = createContext('user-b');

    expect(guard.canActivate(userA.ctx)).toBe(true);
    expect(guard.canActivate(userA.ctx)).toBe(true);

    // 3rd request for user-a is rejected
    try {
      guard.canActivate(userA.ctx);
      fail('Expected 429 HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(userA.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(String),
      );
    }

    // user-b has an independent bucket
    expect(guard.canActivate(userB.ctx)).toBe(true);
  });
});
