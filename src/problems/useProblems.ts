import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';

// Public, user-typed filters only. Never derived from the on-device profile (D-80).
export type Filters = { q?: string; state?: string; jurisdictionId?: string };

export const PAGE_SIZE = '20';

export const useProblems = (f: Filters) =>
  useInfiniteQuery({
    queryKey: ['problems', 'list', f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/problems', {
          params: { query: { limit: PAGE_SIZE, cursor: pageParam, ...f } },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useJurisdictions = () =>
  useQuery({
    queryKey: ['jurisdictions'],
    queryFn: () => unwrap(api.GET('/v1/jurisdictions')).then((r) => r.items),
    staleTime: 5 * 60_000,
  });
