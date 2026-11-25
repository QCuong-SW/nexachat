export interface AppConfiguration {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    cookieName: string;
    cookieMaxAgeMs: number;
  };
  gemini: {
    apiKey: string | undefined;
    model: string;
    modelDisplayName: string;
  };
  chat: {
    maxHistoryMessages: number;
    maxInputChars: number;
    maxContextChars: number;
  };
  rateLimit: {
    ttlMs: number;
    maxRequests: number;
  };
}

function parseDurationToMs(duration: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    return fallbackMs;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

export default (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '7d';

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(process.env.API_PORT ?? 4000),
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, ''),
    databaseUrl: process.env.DATABASE_URL ?? '',
    auth: {
      jwtSecret: process.env.JWT_SECRET ?? '',
      jwtExpiresIn,
      cookieName: process.env.COOKIE_NAME ?? 'nexa_session',
      cookieMaxAgeMs: parseDurationToMs(jwtExpiresIn, 7 * 24 * 60 * 60 * 1000),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
      model: (process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite').trim(),
      modelDisplayName:
        process.env.GEMINI_MODEL_DISPLAY_NAME ?? 'Gemini 3.5 Flash-Lite — Free Tier',
    },
    chat: {
      maxHistoryMessages: Number(process.env.MAX_HISTORY_MESSAGES ?? 20),
      maxInputChars: Number(process.env.MAX_INPUT_CHARS ?? 8000),
      maxContextChars: Number(process.env.MAX_CONTEXT_CHARS ?? 32000),
    },
    rateLimit: {
      ttlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60000),
      maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 20),
    },
  };
};
