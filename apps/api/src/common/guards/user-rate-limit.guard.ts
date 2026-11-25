import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../features/auth/types/auth.types';

/**
 * Rate limiter in-memory theo từng userId (không dùng Redis theo kiến trúc MVP).
 * Hạn chế: reset khi restart server và không đồng bộ giữa nhiều instance.
 */
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  private readonly ttlMs: number;
  private readonly maxRequests: number;
  private readonly buckets = new Map<string, number[]>();

  constructor(configService: ConfigService) {
    this.ttlMs = configService.get<number>('rateLimit.ttlMs') ?? 60_000;
    this.maxRequests =
      configService.get<number>('rateLimit.maxRequests') ?? 20;
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const response = http.getResponse<Response>();

    const key = request.user?.id
      ? `user:${request.user.id}`
      : `ip:${request.ip ?? 'unknown'}`;

    const now = Date.now();
    const windowStart = now - this.ttlMs;
    const timestamps = (this.buckets.get(key) ?? []).filter(
      (ts) => ts > windowStart,
    );

    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(
        1,
        Math.ceil((oldest + this.ttlMs - now) / 1000),
      );
      response.setHeader('Retry-After', String(retryAfterSec));
      this.buckets.set(key, timestamps);

      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: `Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${retryAfterSec} giây.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return true;
  }

  reset(): void {
    this.buckets.clear();
  }
}
