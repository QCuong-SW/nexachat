'use client';

import { Activity, Loader2, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { env } from '@/lib/env';
import { MODEL_SETTINGS_LIMITS } from '../api/settings-storage';
import { useModelSettings } from '../hooks/use-model-settings';
import { useUsage } from '../hooks/use-usage';

export function SettingsPanel() {
  const { settings, updateSettings, resetSettings } = useModelSettings();
  const { data: usage, isLoading: usageLoading } = useUsage();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Cài đặt</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý tham số sinh phản hồi và theo dõi mức sử dụng token trên Gemini
          Free Tier.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Model AI
            </CardTitle>
            <Badge>Free Tier</Badge>
          </div>
          <CardDescription>
            {usage?.modelDisplayName ?? env.NEXT_PUBLIC_MODEL_DISPLAY_NAME}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="settings-temp"
                className="text-sm font-medium text-slate-700"
              >
                Temperature ({settings.temperature.toFixed(1)})
              </label>
              <span className="text-xs text-slate-500">
                {MODEL_SETTINGS_LIMITS.temperature.min} –{' '}
                {MODEL_SETTINGS_LIMITS.temperature.max}
              </span>
            </div>
            <input
              id="settings-temp"
              type="range"
              min={MODEL_SETTINGS_LIMITS.temperature.min}
              max={MODEL_SETTINGS_LIMITS.temperature.max}
              step={MODEL_SETTINGS_LIMITS.temperature.step}
              value={settings.temperature}
              onChange={(e) =>
                updateSettings({ temperature: Number(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="settings-max-tokens"
              className="text-sm font-medium text-slate-700"
            >
              Max Output Tokens
            </label>
            <Input
              id="settings-max-tokens"
              type="number"
              min={MODEL_SETTINGS_LIMITS.maxOutputTokens.min}
              max={MODEL_SETTINGS_LIMITS.maxOutputTokens.max}
              step={MODEL_SETTINGS_LIMITS.maxOutputTokens.step}
              value={settings.maxOutputTokens}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (!Number.isNaN(value)) {
                  updateSettings({ maxOutputTokens: Math.round(value) });
                }
              }}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetSettings}>
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục mặc định
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-indigo-600" />
            Thống kê Token & Độ trễ
          </CardTitle>
          <CardDescription>
            Chỉ thống kê các giá trị token do nhà cung cấp trả về thật (không tự
            ước đoán).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải thống kê...
            </div>
          ) : usage ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Input Tokens</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {usage.totals.inputTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Output Tokens</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {usage.totals.outputTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Phản hồi xong</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {usage.totals.completedMessages}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Độ trễ TB</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {usage.totals.averageDurationMs != null
                    ? `${usage.totals.averageDurationMs} ms`
                    : '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Chưa có dữ liệu sử dụng.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex items-start gap-3 p-5 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-medium">Quyền riêng tư & Hạn mức Free Tier</p>
            <p className="text-xs leading-relaxed text-amber-800">
              {usage?.freeTierNotice ??
                'Nexa Chat chỉ sử dụng Gemini Developer API Free Tier và không có cơ chế tự động chuyển sang model trả phí.'}{' '}
              Vui lòng không gửi thông tin cá nhân nhạy cảm (CCCD, mật khẩu, thẻ
              ngân hàng, dữ liệu mật).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
