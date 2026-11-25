import { HttpException, HttpStatus } from '@nestjs/common';

export type LlmErrorCode =
  | 'LLM_API_KEY_MISSING'
  | 'LLM_INVALID_API_KEY'
  | 'LLM_QUOTA_EXCEEDED'
  | 'LLM_RATE_LIMITED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_TIMEOUT'
  | 'LLM_INVALID_REQUEST'
  | 'LLM_NETWORK_ERROR'
  | 'LLM_CANCELLED'
  | 'LLM_INVALID_OUTPUT';

export class LlmProviderError extends HttpException {
  readonly errorCode: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string, status: HttpStatus) {
    super({ code, message }, status);
    this.errorCode = code;
  }
}

/**
 * Ánh xạ lỗi thô từ Gemini SDK/HTTP sang mã lỗi ứng dụng sạch.
 * KHÔNG bao giờ gắn API key hay stack trace nội bộ vào message trả về client.
 */
export function mapGeminiError(error: unknown): LlmProviderError {
  if (error instanceof LlmProviderError) {
    return error;
  }

  const errObj =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : {};
  const name = typeof errObj.name === 'string' ? errObj.name : '';
  const rawMessage =
    typeof errObj.message === 'string' ? errObj.message : String(error ?? '');
  const lower = rawMessage.toLowerCase();
  const status =
    typeof errObj.status === 'number'
      ? errObj.status
      : typeof errObj.code === 'number'
        ? errObj.code
        : undefined;

  if (name === 'TimeoutError' || lower.includes('timed out') || lower.includes('timeout')) {
    return new LlmProviderError(
      'LLM_TIMEOUT',
      'Yêu cầu tới Gemini API quá thời gian chờ. Vui lòng thử lại.',
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }

  if (name === 'AbortError' || lower.includes('aborted')) {
    return new LlmProviderError(
      'LLM_CANCELLED',
      'Yêu cầu sinh phản hồi đã bị huỷ.',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission_denied')
  ) {
    return new LlmProviderError(
      'LLM_INVALID_API_KEY',
      'Cấu hình GEMINI_API_KEY trên máy chủ không hợp lệ hoặc không có quyền truy cập.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  if (
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded your current quota')
  ) {
    return new LlmProviderError(
      'LLM_QUOTA_EXCEEDED',
      'Hạn mức Gemini Free Tier đã đạt giới hạn. Vui lòng đợi hạn mức đặt lại rồi thử lại.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  if (status === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    return new LlmProviderError(
      'LLM_RATE_LIMITED',
      'Đang gửi quá nhiều yêu cầu tới Gemini Free Tier. Vui lòng thử lại sau ít giây.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  if (status === 400 || lower.includes('invalid_argument')) {
    return new LlmProviderError(
      'LLM_INVALID_REQUEST',
      'Yêu cầu gửi tới mô hình AI không hợp lệ.',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('unavailable') ||
    lower.includes('overloaded')
  ) {
    return new LlmProviderError(
      'LLM_UNAVAILABLE',
      'Dịch vụ Gemini tạm thời không khả dụng. Vui lòng thử lại sau.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('network')
  ) {
    return new LlmProviderError(
      'LLM_NETWORK_ERROR',
      'Lỗi kết nối mạng tới máy chủ Gemini API.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  return new LlmProviderError(
    'LLM_UNAVAILABLE',
    'Không thể nhận phản hồi từ Gemini API lúc này.',
    HttpStatus.BAD_GATEWAY,
  );
}
