'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '@/features/auth/components/login-form';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <LoginForm
        onSubmitCredentials={async (values) => {
          await login(values);
          router.push('/chat');
        }}
      />
    </main>
  );
}
