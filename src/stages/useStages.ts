import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { unwrap } from '../api/unwrap';

export const useStages = (problemId: string) =>
  useQuery({
    queryKey: ['stages', 'by-problem', problemId],
    queryFn: () =>
      unwrap(api.GET('/v1/stages/by-problem/{problemId}', { params: { path: { problemId } } })),
  });
