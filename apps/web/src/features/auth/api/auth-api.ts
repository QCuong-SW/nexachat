import { apiRequest } from '@/lib/api-client';
import type { AuthResponse } from '../types/auth.types';

export const authApi = {
  getMe: () => apiRequest<AuthResponse>('/auth/me', { method: 'GET' }),

  login: (payload: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    }),

  register: (payload: {
    email: string;
    password: string;
    displayName: string;
  }) =>
    apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    }),

  logout: () =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),
};
