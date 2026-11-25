import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z
    .string()
    .url()
    .default('http://localhost:4000/api/v1'),
  NEXT_PUBLIC_MODEL_DISPLAY_NAME: z
    .string()
    .min(1)
    .default('Gemini 3.5 Flash-Lite — Free Tier'),
  NEXT_PUBLIC_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(8000),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || undefined,
  NEXT_PUBLIC_MODEL_DISPLAY_NAME:
    process.env.NEXT_PUBLIC_MODEL_DISPLAY_NAME || undefined,
  NEXT_PUBLIC_MAX_INPUT_CHARS:
    process.env.NEXT_PUBLIC_MAX_INPUT_CHARS || undefined,
});

export const env = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api/v1',
      NEXT_PUBLIC_MODEL_DISPLAY_NAME: 'Gemini 3.5 Flash-Lite — Free Tier',
      NEXT_PUBLIC_MAX_INPUT_CHARS: 8000,
    };
