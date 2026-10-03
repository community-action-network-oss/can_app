import { api } from '../../api/client';
import type { components } from '../../api/schema';
import type { PostFailure } from '../../contributions/api';

type S = components['schemas'];
export type Transition = S['AllowedStageTransitionDto'];
export type Kind = 'start' | 'submit' | 'block' | 'unblock';

/** Which control a transition is. Decided by where it goes and whether it needs words, not by field names. */
export function kindOf(t: Transition, state: string): Kind | null {
  if (t.to === 'blocked') return 'block';
  if (t.to === 'resolving') return 'submit';
  if (state === 'blocked' && t.requires.length) return 'unblock';
  if (state === 'ready' && t.to === 'active' && !t.requires.length) return 'start';
  return null; // unknown transitions are not offered
}

// Body fields the server wants as lists. Typed against the generated bodies, so a contract change fails tsc.
const LISTS: readonly (keyof S['BlockStageBodyDto'] | keyof S['UnblockStageBodyDto'])[] = [
  'attempts',
  'blockedActions',
  'evidence',
];
export const isList = (k: string) => (LISTS as readonly string[]).includes(k);

/** Posts one transition. Returns null on success, otherwise the failure. */
export async function postTransition(
  kind: Kind,
  id: string,
  fields: Record<string, string>,
): Promise<PostFailure | null> {
  const body = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [
      k,
      isList(k)
        ? v
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
        : v.trim(),
    ]),
  );
  const params = { params: { path: { id } } };
  try {
    const r =
      kind === 'start'
        ? await api.POST('/v1/stages/{id}/start', params)
        : kind === 'submit'
          ? await api.POST('/v1/stages/{id}/submit', params)
          : kind === 'block'
            ? await api.POST('/v1/stages/{id}/block', {
                ...params,
                body: body as unknown as S['BlockStageBodyDto'],
              })
            : await api.POST('/v1/stages/{id}/unblock', {
                ...params,
                body: body as unknown as S['UnblockStageBodyDto'],
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
