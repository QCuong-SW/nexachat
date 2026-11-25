'use client';

import { Info, RotateCcw, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { env } from '@/lib/env';
import {
  MODEL_SETTINGS_LIMITS,
  type ModelSettings,
} from '../api/settings-storage';

interface ModelSettingsDialogProps {
  settings: ModelSettings;
  onUpdate: (next: Partial<ModelSettings>) => void;
  onReset: () => void;
}

export function ModelSettingsDialog({
  settings,
  onUpdate,
  onReset,
}: ModelSettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Cấu hình Model</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấu hình sinh phản hồi</DialogTitle>
          <DialogDescription>
            Điều chỉnh tham số tạo văn bản trong phạm vi an toàn cho Free Tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                Model đang sử dụng
              </span>
              <Badge>Free Tier Only</Badge>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {env.NEXT_PUBLIC_MODEL_DISPLAY_NAME}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Model được cố định ở backend để đảm bảo không phát sinh chi phí
              hoặc chuyển sang model trả phí.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="temperature-slider"
                className="text-sm font-medium text-slate-700"
              >
                Temperature
              </label>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              id="temperature-slider"
              type="range"
              min={MODEL_SETTINGS_LIMITS.temperature.min}
              max={MODEL_SETTINGS_LIMITS.temperature.max}
              step={MODEL_SETTINGS_LIMITS.temperature.step}
              value={settings.temperature}
              onChange={(e) =>
                onUpdate({ temperature: Number(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>0.0 (Chính xác, nhất quán)</span>
              <span>2.0 (Sáng tạo hơn)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="max-tokens-input"
                className="text-sm font-medium text-slate-700"
              >
                Max Output Tokens
              </label>
              <span className="text-xs text-slate-500">
                {MODEL_SETTINGS_LIMITS.maxOutputTokens.min} –{' '}
                {MODEL_SETTINGS_LIMITS.maxOutputTokens.max}
              </span>
            </div>
            <Input
              id="max-tokens-input"
              type="number"
              min={MODEL_SETTINGS_LIMITS.maxOutputTokens.min}
              max={MODEL_SETTINGS_LIMITS.maxOutputTokens.max}
              step={MODEL_SETTINGS_LIMITS.maxOutputTokens.step}
              value={settings.maxOutputTokens}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (!Number.isNaN(value)) {
                  onUpdate({ maxOutputTokens: Math.round(value) });
                }
              }}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                Hạn mức Free Tier (RPM/TPM/RPD) bị giới hạn theo Google Cloud
                project.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                Không nhập dữ liệu cá nhân nhạy cảm, mật khẩu hoặc bí mật kinh
                doanh.
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Đặt lại mặc định
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
