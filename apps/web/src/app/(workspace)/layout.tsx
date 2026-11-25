'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function WorkspaceRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" />
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
