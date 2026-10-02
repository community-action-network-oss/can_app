import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';
import type { components } from '../api/schema';

export type Preparation = components['schemas']['PreparationDto'];
export type PrepPart = components['schemas']['PrepPartDto'];

export function usePreparation(id: string) {
  return useQuery({
    queryKey: ['prep', id],
    retry: false,
    queryFn: () =>
      unwrap(api.GET('/v1/me/problems/{id}/preparation', { params: { path: { id } } })),
  });
}

export function useServerDraft(id: string) {
  return useQuery({
    queryKey: ['draft', id],
    retry: false,
    queryFn: () => unwrap(api.GET('/v1/drafts/{id}', { params: { path: { id } } })),
  });
}

/** Every write needs the version the screen last saw (expectedVersion); the preparation read carries it. */
export function usePrepActions(id: string, version: number | undefined) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['prep', id] });
    void qc.invalidateQueries({ queryKey: ['draft', id] });
    void qc.invalidateQueries({ queryKey: ['draft-preview', id] });
  };
  const expectedVersion = version ?? 0;
  const patch = useMutation({
    mutationFn: (b: { sources?: Record<string, unknown>[]; noSourceNote?: string }) =>
      unwrap(
        api.PATCH('/v1/drafts/{id}', { params: { path: { id } }, body: { ...b, expectedVersion } }),
      ),
    onSuccess: refresh,
  });
  const check = useMutation({
    mutationFn: () => unwrap(api.POST('/v1/drafts/{id}/checks', { params: { path: { id } } })),
    onSuccess: refresh,
  });
  const keep = useMutation({
    mutationFn: (flagIds: string[]) =>
      unwrap(
        api.POST('/v1/drafts/{id}/checks/keep', { params: { path: { id } }, body: { flagIds } }),
      ),
    onSuccess: refresh,
  });
  // T01. The server decides; a refusal comes back as field errors on the parts.
  const send = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/drafts/{id}/transitions', {
          params: { path: { id } },
          body: { to: 'in_review', expectedVersion },
        }),
      ),
    onSettled: refresh,
  });
  return { patch, check, keep, send };
}
