process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://nexa_user:test@127.0.0.1:5432/nexa_chat_test?schema=public';
process.env.JWT_SECRET ??=
  'test_jwt_secret_key_that_is_definitely_longer_than_32_chars';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
process.env.COOKIE_NAME ??= 'nexa_session';
process.env.GEMINI_MODEL ??= 'gemini-3.5-flash-lite';
