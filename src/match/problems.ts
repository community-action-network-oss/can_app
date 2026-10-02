import { api } from '../api/client';
import { unwrap } from '../api/unwrap';

// Profile-blind by construction: no arguments, so the request is the same one any anonymous visitor makes (D-80).
export const PUBLIC_LIST_LIMIT = '50';

export const fetchPublicProblems = () =>
  unwrap(api.GET('/v1/problems', { params: { query: { limit: PUBLIC_LIST_LIMIT } } })).then(
    (p) => p.items,
  );
