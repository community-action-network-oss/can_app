import { usePathname, useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { useSession } from '../navigation/SessionContext';

/** Sends a guest to /sign-in with returnTo set to the current path. Returns true when a member is present. */
export function useRequireAuth(): boolean {
  const { status } = useSession();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (status === 'guest') router.replace({ pathname: '/sign-in', params: { returnTo: path } });
  }, [status, router, path]);
  return status === 'member';
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return useRequireAuth() ? <>{children}</> : null;
}
