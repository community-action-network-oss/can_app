import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';
import type { PostFailure } from '../contributions/api';

export const useStageDecision = (stageId: string) =>
  useQuery({
    enabled: !!stageId,
    retry: false,
    queryKey: ['stage-decision', stageId],
    queryFn: () =>
      unwrap(api.GET('/v1/stages/{id}/decision', { params: { path: { id: stageId } } })),
  });

/** Records the choice. Returns null on success, otherwise the failure (gate_held, gate_blocked, needs_revision carry a code). */
export async function postChoice(
  stageId: string,
  content: Record<string, unknown>,
  stamp: { schemaVersion?: string; schemaHash?: string },
): Promise<PostFailure | null> {
  try {
    const r = await api.POST('/v1/stages/{id}/choice', {
      params: { path: { id: stageId } },
      body: { content, ...stamp },
    });
    if (r.response.ok) return null;
    const e = ((r.error as { error?: Record<string, unknown> } | undefined)?.error ?? {}) as Record<
      string,
      unknown
    >;
    return {
      status: r.response.status,
      code: typeof e.code === 'string' ? e.code : 'unknown',
      fieldErrors: e.fieldErrors as PostFailure['fieldErrors'],
    };
  } catch {
    return { status: 0, code: 'offline', offline: true };
  }
}
