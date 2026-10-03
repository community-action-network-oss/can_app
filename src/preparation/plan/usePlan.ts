import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../api/client';
import { unwrap } from '../../api/unwrap';
import type { PlanCheck, PlanNode } from './model';

export const useTemplates = (enabled: boolean) =>
  useQuery({
    enabled,
    retry: false,
    queryKey: ['stage-templates'],
    queryFn: () => unwrap(api.GET('/v1/stage-templates')),
  });

/** Asks the server's own rules (dry run) shortly after each change. `check` is only set for the nodes it was asked about. */
export function usePlanCheck(id: string, nodes: PlanNode[], enabled: boolean) {
  const [done, setDone] = useState<{ for: PlanNode[]; check: PlanCheck } | null>(null);
  const m = useMutation({
    mutationFn: async (stages: PlanNode[]) => ({
      for: stages,
      check: await unwrap(
        api.POST('/v1/drafts/{id}/stage-plan/validate', {
          params: { path: { id } },
          body: { stages: stages as never },
        }),
      ),
    }),
    onSuccess: setDone,
  });
  const { mutate } = m;
  useEffect(() => {
    if (!enabled) return;
    const h = setTimeout(() => mutate(nodes), 300);
    return () => clearTimeout(h);
  }, [nodes, enabled, mutate]);
  return { check: done?.for === nodes ? done.check : undefined, error: m.error };
}

export function useSavePlan(id: string, version: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stages: PlanNode[]) =>
      unwrap(
        api.PUT('/v1/drafts/{id}/stage-plan', {
          params: { path: { id } },
          body: { stages: stages as never, expectedVersion: version ?? 0 },
        }),
      ),
    onSettled: () => {
      for (const k of ['prep', 'draft', 'draft-preview'])
        void qc.invalidateQueries({ queryKey: [k, id] });
    },
  });
}
