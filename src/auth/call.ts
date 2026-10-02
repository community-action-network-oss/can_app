import { ApiError, offlineError, parseApiError } from '../api/errors';

type Result<T> = { data?: T; error?: unknown; response: Response };
export type AuthError = ApiError & { retryAfter?: number };

/** Like unwrap, but keeps Retry-After (seconds) on a 429 so the screen can say how long to wait. */
export async function authCall<T>(promise: Promise<Result<T>>): Promise<NonNullable<T>> {
  let r: Result<T>;
  try {
    r = await promise;
  } catch (e) {
    throw e instanceof TypeError ? offlineError() : e;
  }
  if (r.response.ok) return r.data as NonNullable<T>;
  const err: AuthError = await parseApiError(r.response, r.error);
  const ra = Number(r.response.headers.get('Retry-After'));
  if (r.response.status === 429 || err.kind === 'rate_limited') {
    err.retryAfter = ra > 0 ? ra : 600;
  }
  throw err;
}

/** The one message for a failed auth call, or undefined to fall through to the form kit's generic handling. */
export function rateLimitMinutes(e: unknown): number | undefined {
  const s = (e as AuthError | undefined)?.retryAfter;
  return e instanceof ApiError && s ? Math.max(1, Math.ceil(s / 60)) : undefined;
}
