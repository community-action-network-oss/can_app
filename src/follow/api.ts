import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';

const KEY = ['me', 'follows'] as const;

export const useMyFollows = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: KEY,
    retry: false,
    queryFn: () => unwrap(api.GET('/v1/me/follows')),
  });

// Pessimistic on purpose: the screen shows what the server holds, so consent is never shown as given when it was not.
export function useFollowActions(problemId: string) {
  const qc = useQueryClient();
  const params = { params: { path: { problemId } } };
  const done = { onSettled: () => qc.invalidateQueries({ queryKey: KEY }) };
  const follow = useMutation({
    ...done,
    mutationFn: (emailUpdates: boolean) =>
      unwrap(api.POST('/v1/follows', { body: { problemId, emailUpdates } })),
  });
  const unfollow = useMutation({
    ...done,
    mutationFn: async () => {
      const r = await api.DELETE('/v1/follows/{problemId}', params).catch((e: unknown) => {
        throw e instanceof TypeError ? new TypeError('offline') : e;
      });
      if (!r.response.ok) throw new Error('unfollow');
    },
  });
  const mute = useMutation({
    ...done,
    mutationFn: (muted: boolean) =>
      unwrap(
        muted
          ? api.POST('/v1/follows/{problemId}/mute', params)
          : api.POST('/v1/follows/{problemId}/unmute', params),
      ),
  });
  return { follow, unfollow, mute };
}

export function useStopAllEmails() {
  const qc = useQueryClient();
  return useMutation({
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    mutationFn: async () => {
      const r = await api.DELETE('/v1/me/follows/email-consent');
      if (!r.response.ok) throw new Error('email-consent');
    },
  });
}
