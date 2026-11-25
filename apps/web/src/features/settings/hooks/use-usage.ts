'use client';

import { useQuery } from '@tanstack/react-query';
import { usageApi } from '../api/usage-api';

export function useUsage() {
  return useQuery({
    queryKey: ['usage', 'me'],
    queryFn: () => usageApi.getMyUsage(),
  });
}
