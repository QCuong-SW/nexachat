import { env } from './env';

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: string[];
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: string[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${env.NEXT_PUBLIC_API_BASE_URL}${normalizedPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Không thể kết nối tới máy chủ API. Hãy kiểm tra backend đã chạy chưa.',
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const payload = (data ?? {}) as ApiErrorPayload;
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'HTTP_ERROR',
      payload.error?.message ?? `Request failed (${response.status})`,
      payload.error?.details,
    );
  }

  return data as T;
}
