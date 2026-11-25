'use client';

import { useRouter } from 'next/navigation';
import { RegisterForm } from '@/features/auth/components/register-form';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <RegisterForm
        onSubmitRegistration={async (values) => {
          await register(values);
          router.push('/chat');
        }}
      />
    </main>
  );
}
