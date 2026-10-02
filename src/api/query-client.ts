import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './errors';

const retry = (count: number, e: unknown) =>
  !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry,
      retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
      // 'always' lets the request run and fail as an offline ApiError instead of pausing silently
      networkMode: 'always',
    },
    mutations: { retry: false, networkMode: 'always' },
  },
});
