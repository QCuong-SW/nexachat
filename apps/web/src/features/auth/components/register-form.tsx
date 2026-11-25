'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import {
  registerSchema,
  type RegisterFormValues,
} from '../schemas/auth.schemas';

interface RegisterFormProps {
  onSubmitRegistration: (values: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
}

export function RegisterForm({ onSubmitRegistration }: RegisterFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      await onSubmitRegistration({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Đăng ký thất bại. Vui lòng thử lại.');
      }
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200/90 shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">Tạo tài khoản Nexa Chat</CardTitle>
        <CardDescription>
          Bắt đầu học và thực hành LLM Engineering với Gemini Free Tier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Lưu ý quyền riêng tư (Free Tier):</strong> Gemini API Free
            Tier có giới hạn hạn mức và dữ liệu gửi lên có thể được dùng để cải
            thiện sản phẩm. Không nhập mật khẩu, thông tin cá nhân nhạy cảm hay
            dữ liệu bí mật vào khung chat.
          </span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="register-name"
              className="text-sm font-medium text-slate-700"
            >
              Tên hiển thị
            </label>
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              aria-invalid={!!errors.displayName}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs text-red-600">
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-email"
              className="text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-password"
              className="text-sm font-medium text-slate-700"
            >
              Mật khẩu
            </label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="Ít nhất 8 ký tự"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="register-confirm"
              className="text-sm font-medium text-slate-700"
            >
              Xác nhận mật khẩu
            </label>
            <Input
              id="register-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              'Tạo tài khoản'
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
