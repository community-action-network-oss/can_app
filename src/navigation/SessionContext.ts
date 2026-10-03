import { createContext, useContext } from 'react';

export type Session = {
  status: 'loading' | 'guest' | 'member';
  roles?: string[];
  /** Volunteer review opt-in (an account flag, not a role). */
  reviewOptIn?: boolean;
  handle?: string;
};

// Guest default keeps the shell independent of the server; the session provider unit supplies the real value.
export const SessionContext = createContext<Session>({ status: 'guest' });
export const useSession = () => useContext(SessionContext);
