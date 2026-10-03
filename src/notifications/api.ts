import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';

const KEY = ['me', 'notifications'] as const;

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: KEY,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/me/notifications', { params: { query: { limit: '20', cursor: pageParam } } }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

const ok = async (p: Promise<{ response: Response }>) => {
  if (!(await p).response.ok) throw new Error('notifications');
};

export function useMarkRead() {
  const qc = useQueryClient();
  const onSettled = () => qc.invalidateQueries({ queryKey: KEY });
  const one = useMutation({
    onSettled,
    mutationFn: (id: string) =>
      ok(api.POST('/v1/me/notifications/{id}/read', { params: { path: { id } } })),
  });
  const all = useMutation({
    onSettled,
    mutationFn: () => ok(api.POST('/v1/me/notifications/read-all')),
  });
  return { one, all };
}
