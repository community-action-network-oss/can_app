import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';

export const useProblem = (id: string) =>
  useQuery({
    queryKey: ['problems', 'detail', id],
    queryFn: () => unwrap(api.GET('/v1/problems/{id}', { params: { path: { id } } })),
  });

export const useProblemEvents = (id: string, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ['problems', 'events', id],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/problems/{id}/events', {
          params: { path: { id }, query: { limit: '20', cursor: pageParam } },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
