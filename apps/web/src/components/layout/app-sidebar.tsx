'use client';

import {
  FlaskConical,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ConversationList } from '@/features/conversations/components/conversation-list';
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useRenameConversation,
} from '@/features/conversations/hooks/use-conversations';

interface AppSidebarProps {
  onCloseMobile?: () => void;
}

export function AppSidebar({ onCloseMobile }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError } = useConversations(debouncedSearch);
  const createMutation = useCreateConversation();
  const renameMutation = useRenameConversation();
  const deleteMutation = useDeleteConversation();

  const conversations = data?.items ?? [];
  const activeConversationId = pathname?.startsWith('/chat/')
    ? pathname.split('/chat/')[1]
    : undefined;

  const handleNewChat = async () => {
    const res = await createMutation.mutateAsync({});
    router.push(`/chat/${res.conversation.id}`);
    onCloseMobile?.();
  };

  const handleRename = (id: string, title: string) => {
    renameMutation.mutate({ id, title });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (id === activeConversationId) {
          router.push('/chat');
        }
      },
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-slate-50/80">
      {/* Brand header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5">
        <Link
          href="/chat"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Nexa Chat
            </span>
            <p className="text-[11px] text-slate-500">LLM Engineering Lab</p>
          </div>
        </Link>
        {onCloseMobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            aria-label="Đóng thanh bên"
            className="lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Chat & Search */}
      <div className="space-y-2.5 p-3">
        <Button
          onClick={handleNewChat}
          disabled={createMutation.isPending}
          className="w-full justify-start"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Cuộc trò chuyện mới
        </Button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm kiếm hội thoại..."
            aria-label="Tìm kiếm hội thoại"
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải lịch sử...
          </div>
        ) : isError ? (
          <div className="px-3 py-6 text-center text-xs text-red-600">
            Không thể tải danh sách hội thoại.
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onRename={handleRename}
            onDelete={handleDelete}
            onNavigate={onCloseMobile}
          />
        )}
      </div>

      {/* Footer: LLM Labs, Settings & User Profile */}
      <div className="space-y-1.5 border-t border-slate-200/80 bg-white/70 p-3">
        <Link
          href="/labs"
          onClick={onCloseMobile}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <FlaskConical className="h-4 w-4 text-indigo-500" />
          LLM Labs (JSON & Tools)
        </Link>

        <Link
          href="/settings"
          onClick={onCloseMobile}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Settings className="h-4 w-4 text-slate-400" />
          Cài đặt Model & Quota
        </Link>

        {user && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-900">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {user.email}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
