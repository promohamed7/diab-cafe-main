import { createContext, useContext } from 'react';
import type { AdminUser } from './api';

export interface Session {
  user: AdminUser;
  isSuper: boolean;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('no admin session');
  return s;
}

export const navigate = (path: string): void => {
  window.location.hash = `#/${path}`;
};
