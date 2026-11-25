'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useConversations } from '@/features/conversations/hooks/use-conversations';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { data } = useConversations();

  const activeId = pathname?.startsWith('/chat/')
    ? pathname.split('/chat/')[1]
    : undefined;
  const activeConversation = data?.items.find((c) => c.id === activeId);
  const headerTitle = pathname?.startsWith('/settings')
    ? 'Cài đặt'
    : pathname?.startsWith('/labs')
      ? 'LLM Engineering Labs'
      : activeConversation?.title ?? 'Cuộc trò chuyện mới';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Desktop collapsible sidebar */}
      <div
        className={`hidden transition-all duration-200 lg:block ${
          isDesktopSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}
      >
        <AppSidebar />
      </div>

      {/* Mobile slide-over drawer */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full shadow-xl">
            <AppSidebar onCloseMobile={() => setIsMobileDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          title={headerTitle}
          isDesktopSidebarOpen={isDesktopSidebarOpen}
          onToggleDesktopSidebar={() =>
            setIsDesktopSidebarOpen((prev) => !prev)
          }
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        />
        <main className="flex min-h-0 flex-1 flex-col bg-slate-50/40">
          {children}
        </main>
      </div>
    </div>
  );
}
