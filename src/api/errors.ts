export type ApiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'session_expired'
  | 'not_permitted'
  | 'not_found'
  | 'rate_limited'
  | 'offline'
  | 'server';

// Server codes (can_server 89d9fd4). conflict has no kind of its own: it is a
// request the user can fix, so it reads as validation. policy_unavailable is a
// server-side outage, so it reads as server.
const KIND_BY_CODE: Record<string, ApiErrorKind> = {
  validation_failed: 'validation',
  conflict: 'validation',
  unauthenticated: 'unauthenticated',
  session_expired: 'session_expired',
  not_permitted: 'not_permitted',
  not_found: 'not_found',
  rate_limited: 'rate_limited',
  internal: 'server',
  policy_unavailable: 'server',
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly kind: ApiErrorKind,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const offlineError = () => new ApiError(0, 'offline', 'Network request failed', 'offline');

type Envelope = { error?: { code?: unknown; message?: unknown; fieldErrors?: unknown } };

/** Reads the {error:{code,message,fieldErrors}} envelope. Pass `body` when it was already consumed. */
export async function parseApiError(response: Response, body?: unknown): Promise<ApiError> {
  if (body === undefined)
    body = await response
      .clone()
      .json()
      .catch(() => undefined);
  const e = (body as Envelope | undefined)?.error;
  const code = typeof e?.code === 'string' ? e.code : 'unknown';
  const message = typeof e?.message === 'string' ? e.message : response.statusText;
  const fe = e?.fieldErrors;
  const fieldErrors = fe && typeof fe === 'object' ? (fe as Record<string, string>) : undefined;
  return new ApiError(response.status, code, message, KIND_BY_CODE[code] ?? 'server', fieldErrors);
}
