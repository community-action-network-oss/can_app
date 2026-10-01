import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      // 503 still carries a HealthDto ("degraded"), so it is data, not an error.
      const { data, error } = await api.GET('/health');
      const body = data ?? error;
      if (!body) throw new Error('health: empty response');
      return body;
    },
    retry: false,
  });
}
