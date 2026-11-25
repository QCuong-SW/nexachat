'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { authApi } from '@/features/auth/api/auth-api';
import type { AuthUser } from '@/features/auth/types/auth.types';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<AuthUser>;
  register: (payload: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await authApi.getMe();
        return res.user;
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const login = useCallback(
    async (payload: { email: string; password: string }) => {
      const res = await authApi.login(payload);
      queryClient.setQueryData(AUTH_QUERY_KEY, res.user);
      return res.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      displayName: string;
    }) => {
      const res = await authApi.register(payload);
      queryClient.setQueryData(AUTH_QUERY_KEY, res.user);
      return res.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({ queryKey: ['conversations'] });
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return ctx;
}
