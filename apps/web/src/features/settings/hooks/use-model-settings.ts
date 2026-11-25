'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_MODEL_SETTINGS,
  loadModelSettings,
  modelSettingsSchema,
  saveModelSettings,
  type ModelSettings,
} from '../api/settings-storage';

export function useModelSettings() {
  const [settings, setSettings] = useState<ModelSettings>(
    DEFAULT_MODEL_SETTINGS,
  );

  useEffect(() => {
    setSettings(loadModelSettings());
  }, []);

  const updateSettings = useCallback((next: Partial<ModelSettings>) => {
    setSettings((prev) => {
      const candidate = { ...prev, ...next };
      const parsed = modelSettingsSchema.safeParse(candidate);
      if (!parsed.success) {
        return prev;
      }
      saveModelSettings(parsed.data);
      return parsed.data;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_MODEL_SETTINGS);
    saveModelSettings(DEFAULT_MODEL_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
