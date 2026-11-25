'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModelSettingsDialog } from '@/features/settings/components/model-settings-dialog';
import { useModelSettings } from '@/features/settings/hooks/use-model-settings';
import { env } from '@/lib/env';

interface AppHeaderProps {
  title?: string;
  isDesktopSidebarOpen: boolean;
  onToggleDesktopSidebar: () => void;
  onOpenMobileDrawer: () => void;
}

export function AppHeader({
  title,
  isDesktopSidebarOpen,
  onToggleDesktopSidebar,
  onOpenMobileDrawer,
}: AppHeaderProps) {
  const { settings, updateSettings, resetSettings } = useModelSettings();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenMobileDrawer}
          aria-label="Mở menu hội thoại"
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleDesktopSidebar}
          aria-label={
            isDesktopSidebarOpen ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên'
          }
          className="hidden lg:inline-flex"
        >
          {isDesktopSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-900">
            {title || 'Nexa Chat'}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge className="hidden md:inline-flex">
          {env.NEXT_PUBLIC_MODEL_DISPLAY_NAME}
        </Badge>
        <ModelSettingsDialog
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
        />
      </div>
    </header>
  );
}
