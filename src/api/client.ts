import createClient from 'openapi-fetch';

import type { paths } from './schema';

export const api = createClient<paths>({
  // late-bound so tests can mock global fetch
  fetch: (req) => globalThis.fetch(req),
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
});
