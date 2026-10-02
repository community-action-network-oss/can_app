import createClient, { type Middleware } from 'openapi-fetch';
import { Platform } from 'react-native';

import { sessionEvents } from './session-events';
import type { paths } from './schema';

const WRITE = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function csrfToken(): string | undefined {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith('can_csrf='))
    ?.slice('can_csrf='.length);
}

const middleware: Middleware = {
  onRequest({ request }) {
    const token = WRITE.has(request.method) ? csrfToken() : undefined;
    if (token) request.headers.set('X-CAN-CSRF', decodeURIComponent(token));
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      const body = await response
        .clone()
        .json()
        .catch(() => undefined);
      if (body?.error?.code === 'session_expired') sessionEvents.emitExpired();
    }
    return response;
  },
};

export const api = createClient<paths>({
  // late-bound so tests can mock global fetch
  fetch: (req) => globalThis.fetch(req),
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  ...(Platform.OS === 'web' ? { credentials: 'include' as const } : {}),
});
api.use(middleware);
