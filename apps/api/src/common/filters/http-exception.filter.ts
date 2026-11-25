import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        code = this.statusToCode(status);
        message = res;
      } else if (res && typeof res === 'object') {
        const payload = res as Record<string, unknown>;
        code =
          typeof payload.code === 'string'
            ? payload.code
            : this.statusToCode(status);

        if (Array.isArray(payload.message)) {
          message = 'Validation failed.';
          details = payload.message.map(String);
          code = 'VALIDATION_ERROR';
        } else if (typeof payload.message === 'string') {
          message = payload.message;
        } else {
          message = exception.message || message;
        }
      }
    } else {
      // Không bao giờ trả stack trace hoặc thông tin nhạy cảm cho client
      const errName = exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${errName}`,
      );
    }

    const body: ErrorResponseBody = {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(body);
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'HTTP_ERROR';
    }
  }
}
