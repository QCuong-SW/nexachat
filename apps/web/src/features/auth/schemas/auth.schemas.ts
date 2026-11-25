import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email.')
    .email('Địa chỉ email không hợp lệ.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Tên hiển thị phải có ít nhất 2 ký tự.')
      .max(80, 'Tên hiển thị không được vượt quá 80 ký tự.'),
    email: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập email.')
      .email('Địa chỉ email không hợp lệ.'),
    password: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
      .max(128, 'Mật khẩu không được vượt quá 128 ký tự.'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp.',
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
