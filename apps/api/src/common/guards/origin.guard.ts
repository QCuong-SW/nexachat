import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Bảo vệ chống CSRF kết hợp với SameSite=Lax:
 * Kiểm tra Origin / Referer / Sec-Fetch-Site trên mọi request thay đổi trạng thái.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(private readonly configService: ConfigService) {
    const raw =
      this.configService.get<string>('corsOrigin') ?? 'http://localhost:3000';
    this.allowedOrigin = raw.replace(/\/$/, '').toLowerCase();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = (request.method ?? 'GET').toUpperCase();

    if (!STATE_CHANGING_METHODS.has(method)) {
      return true;
    }

    const secFetchSite = this.firstHeader(request.headers['sec-fetch-site']);
    if (secFetchSite && secFetchSite.toLowerCase() === 'cross-site') {
      throw new ForbiddenException({
        code: 'INVALID_ORIGIN',
        message: 'Cross-site state-changing requests are not allowed.',
      });
    }

    const originHeader = this.firstHeader(request.headers['origin']);
    if (originHeader) {
      const normalized = originHeader.replace(/\/$/, '').toLowerCase();
      if (normalized !== this.allowedOrigin) {
        throw new ForbiddenException({
          code: 'INVALID_ORIGIN',
          message: 'Request origin is not allowed.',
        });
      }
      return true;
    }

    const refererHeader = this.firstHeader(request.headers['referer']);
    if (refererHeader) {
      try {
        const refererOrigin = new URL(refererHeader).origin.toLowerCase();
        if (refererOrigin !== this.allowedOrigin) {
          throw new ForbiddenException({
            code: 'INVALID_ORIGIN',
            message: 'Request referer origin is not allowed.',
          });
        }
      } catch (err) {
        if (err instanceof ForbiddenException) {
          throw err;
        }
        throw new ForbiddenException({
          code: 'INVALID_ORIGIN',
          message: 'Invalid referer header.',
        });
      }
    }

    return true;
  }

  private firstHeader(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
}
