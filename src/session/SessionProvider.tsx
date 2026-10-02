import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { unwrap } from '../api/unwrap';
import { SessionContext, type Session } from '../navigation/SessionContext';

export const ME_KEY = ['me'] as const;

type Actions = { refresh: () => Promise<void>; clear: () => Promise<void> };
const ActionsContext = createContext<Actions>({
  refresh: async () => {},
  clear: async () => {},
});
export const useSessionActions = () => useContext(ActionsContext);

async function loadMe() {
  try {
    return await unwrap(api.GET('/v1/me'));
  } catch (e) {
    // 401 means guest, not an error
    if (e instanceof ApiError && (e.kind === 'unauthenticated' || e.kind === 'session_expired'))
      return null;
    throw e;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ME_KEY, queryFn: loadMe, staleTime: Infinity });

  const session = useMemo<Session>(() => {
    if (me.isPending) return { status: 'loading' };
    // Offline or server error on boot: show the guest frame; nothing member-only is exposed.
    if (!me.data) return { status: 'guest' };
    return { status: 'member', handle: me.data.handle, roles: [me.data.role] };
  }, [me.isPending, me.data]);

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ME_KEY }), [qc]);

  // Logout: server first, but always clear locally so a failed call cannot leave member data on screen.
  const clear = useCallback(async () => {
    try {
      await api.POST('/v1/auth/logout'); // 204, no body
    } finally {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
      qc.setQueryData(ME_KEY, null);
    }
  }, [qc]);

  const actions = useMemo(() => ({ refresh, clear }), [refresh, clear]);
  return (
    <SessionContext.Provider value={session}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </SessionContext.Provider>
  );
}
