import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';
import { unwrap } from '../../api/unwrap';

/** Content schema for a type (active version unless one is pinned). Errors surface as ApiError (503 policy_unavailable is kind "server"). */
export function useContentSchema(type: string, opts: { version?: string; enabled?: boolean } = {}) {
  return useQuery({
    enabled: opts.enabled ?? true,
    retry: false,
    queryKey: ['content-schema', type, opts.version ?? 'active'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/content-schemas/{type}', {
          params: { path: { type }, query: opts.version ? { version: opts.version } : {} },
        }),
      ),
  });
}
