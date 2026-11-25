import { z } from 'zod';

export const MODEL_SETTINGS_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1, default: 0.7 },
  maxOutputTokens: { min: 64, max: 8192, step: 64, default: 1024 },
} as const;

export const modelSettingsSchema = z.object({
  temperature: z
    .number()
    .min(MODEL_SETTINGS_LIMITS.temperature.min)
    .max(MODEL_SETTINGS_LIMITS.temperature.max),
  maxOutputTokens: z
    .number()
    .int()
    .min(MODEL_SETTINGS_LIMITS.maxOutputTokens.min)
    .max(MODEL_SETTINGS_LIMITS.maxOutputTokens.max),
});

export type ModelSettings = z.infer<typeof modelSettingsSchema>;

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: MODEL_SETTINGS_LIMITS.temperature.default,
  maxOutputTokens: MODEL_SETTINGS_LIMITS.maxOutputTokens.default,
};

const STORAGE_KEY = 'nexa_chat_model_settings_v1';

export function loadModelSettings(): ModelSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_MODEL_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_SETTINGS;
    const parsed = modelSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_MODEL_SETTINGS;
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

export function saveModelSettings(settings: ModelSettings): void {
  if (typeof window === 'undefined') return;
  const parsed = modelSettingsSchema.safeParse(settings);
  if (parsed.success) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
  }
}
