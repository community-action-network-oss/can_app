import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';
import { unwrap } from '../../api/unwrap';
import type { PostFailure } from '../../contributions/api';

export const useStageOptions = (stageId: string) =>
  useQuery({
    enabled: !!stageId,
    retry: false,
    queryKey: ['stage-options', stageId],
    queryFn: () =>
      unwrap(api.GET('/v1/stages/{id}/options', { params: { path: { id: stageId } } })),
  });

/** Adds an option. Returns null on success, otherwise the failure with the extra fields ApiError drops. */
export async function postOption(
  stageId: string,
  content: Record<string, unknown>,
  stamp: { schemaVersion?: string; schemaHash?: string },
): Promise<PostFailure | null> {
  try {
    const r = await api.POST('/v1/stages/{id}/options', {
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
      retryAfterSeconds: typeof e.retryAfterSeconds === 'number' ? e.retryAfterSeconds : undefined,
      resetsAt: typeof e.resetsAt === 'string' ? e.resetsAt : undefined,
    };
  } catch {
    return { status: 0, code: 'offline', offline: true };
  }
}
