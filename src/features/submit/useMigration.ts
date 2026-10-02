import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';
import { unwrap } from '../../api/unwrap';

/** The migration plan. Minor and patch changes move on this call, so it is only asked for saved drafts. */
export function useMigrationPlan(id: string) {
  return useQuery({
    enabled: id !== 'new',
    retry: false,
    queryKey: ['draft-migration', id],
    queryFn: () => unwrap(api.GET('/v1/drafts/{id}/migration', { params: { path: { id } } })),
  });
}
