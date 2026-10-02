import { ApiError, offlineError, parseApiError } from './errors';

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Returns data or throws ApiError. For TanStack Query queryFn and mutationFn. */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<NonNullable<T>> {
  let r: Result<T>;
  try {
    r = await promise;
  } catch (e) {
    // fetch rejects with TypeError when there is no network
    throw e instanceof TypeError ? offlineError() : e;
  }
  if (r.response.ok) return r.data as NonNullable<T>;
  throw r.error instanceof ApiError ? r.error : await parseApiError(r.response, r.error);
}
