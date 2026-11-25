import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OriginGuard } from './origin.guard';

function createHttpContext(
  method: string,
  headers: Record<string, string | undefined>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  let guard: OriginGuard;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as ConfigService;
    guard = new OriginGuard(configService);
  });

  it('allows safe GET requests regardless of Origin', () => {
    const ctx = createHttpContext('GET', { origin: 'https://evil.example' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows POST when Origin matches configured CORS_ORIGIN', () => {
    const ctx = createHttpContext('POST', { origin: 'http://localhost:3000' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects POST when Origin does not match', () => {
    const ctx = createHttpContext('POST', { origin: 'https://evil.example' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects DELETE when Referer origin does not match', () => {
    const ctx = createHttpContext('DELETE', {
      referer: 'https://evil.example/attack',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects PATCH when Sec-Fetch-Site is cross-site', () => {
    const ctx = createHttpContext('PATCH', {
      'sec-fetch-site': 'cross-site',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
