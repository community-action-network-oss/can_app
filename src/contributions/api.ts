import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import type { components } from '../api/schema';
import { unwrap } from '../api/unwrap';

export type Flag = { id: string; field: string; severity: string };
/** The extra fields the server puts beside code and message on 400 and 429. ApiError does not carry them. */
export type PostFailure = {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;
  flags?: Flag[];
  retryAfterSeconds?: number;
  resetsAt?: string;
  offline?: boolean;
};

export const useContributions = (
  problemId: string,
  o: { stageId?: string; problemLevel?: boolean },
) =>
  useQuery({
    queryKey: ['contributions', problemId, o.stageId ?? null, !!o.problemLevel],
    retry: false,
    queryFn: () =>
      unwrap(
        api.GET('/v1/contributions/by-problem/{problemId}', {
          params: {
            path: { problemId },
            query: {
              ...(o.stageId ? { stageId: o.stageId } : {}),
              ...(o.problemLevel ? { problemLevel: 'true' } : {}),
            },
          },
        }),
      ),
  });

export const useStage = (id: string | undefined) =>
  useQuery({
    enabled: !!id,
    retry: false,
    queryKey: ['stages', 'detail', id],
    queryFn: () => unwrap(api.GET('/v1/stages/{id}', { params: { path: { id: id ?? '' } } })),
  });

export const useReplyAllowance = (problemId: string, enabled = true) =>
  useQuery({
    enabled,
    retry: false,
    queryKey: ['reply-allowance', problemId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/me/problems/{id}/reply-allowance', { params: { path: { id: problemId } } }),
      ),
  });

export type CreateBody = components['schemas']['CreateContributionDto'];

/** Posts a reply. Returns null on success, otherwise the failure with its extra fields. */
export async function postContribution(
  problemId: string,
  body: CreateBody,
): Promise<PostFailure | null> {
  try {
    const r = await api.POST('/v1/contributions/by-problem/{problemId}', {
      params: { path: { problemId } },
      body,
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
      flags: Array.isArray(e.flags) ? (e.flags as Flag[]) : undefined,
      retryAfterSeconds: typeof e.retryAfterSeconds === 'number' ? e.retryAfterSeconds : undefined,
      resetsAt: typeof e.resetsAt === 'string' ? e.resetsAt : undefined,
    };
  } catch {
    return { status: 0, code: 'offline', offline: true };
  }
}
