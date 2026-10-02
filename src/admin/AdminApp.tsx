// INBYTE Admin — internal administration of the INBYTE Digital Menu Platform.
// Hash routing keeps every admin URL inside /admin/ (no server routes needed).

import React, { useCallback, useEffect, useState } from 'react';
import type { AdminUser } from './api';
import { api, currentSession, setSession } from './api';
import type { Session } from './session';
import { SessionContext } from './session';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CafesPage } from './pages/CafesPage';
import { CafeWorkspace } from './pages/CafeWorkspace';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';

function useHashRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const NAV = [
  { path: '', label: 'Dashboard', icon: '◧' },
  { path: 'cafes', label: 'Cafés', icon: '☕' },
  { path: 'audit', label: 'Audit log', icon: '☰' },
  { path: 'settings', label: 'Settings', icon: '⚙' }
];

export const AdminApp: React.FC = () => {
  const [session, setSessionState] = useState<Session | null | 'loading'>('loading');
  const route = useHashRoute();

  const expire = useCallback(() => setSessionState(null), []);
  const start = useCallback(
    (user: AdminUser, csrf: string) => {
      setSession(csrf, expire);
      setSessionState({ user, isSuper: user.role === 'INBYTE_SUPER_ADMIN' });
    },
    [expire]
  );

  useEffect(() => {
    currentSession().then((s) => (s ? start(s.user, s.csrfToken) : setSessionState(null)));
  }, [start]);

  if (session === 'loading') return <div className="admin-loading">Loading…</div>;
  if (!session) return <LoginPage onSignedIn={start} />;

  const [section, id, tab] = route;
  let page: React.ReactNode;
  if (section === 'cafes' && id) page = <CafeWorkspace tenantId={id} tab={tab ?? 'overview'} />;
  else if (section === 'cafes') page = <CafesPage />;
  else if (section === 'audit') page = <AuditPage />;
  else if (section === 'settings') page = <SettingsPage />;
  else page = <DashboardPage />;

  return (
    <SessionContext.Provider value={session}>
      <div className="admin-shell">
        <aside className="admin-nav">
          <div className="admin-brand">
            <strong>INBYTE</strong>
            <span>Digital Menu Platform</span>
          </div>
          <nav>
            {NAV.map((n) => (
              <a key={n.path} href={`#/${n.path}`} className={(section ?? '') === n.path ? 'is-active' : ''}>
                <span aria-hidden="true">{n.icon}</span> {n.label}
              </a>
            ))}
          </nav>
          <div className="admin-user">
            <span title={session.user.email}>{session.user.displayName}</span>
            <small>{session.isSuper ? 'Super admin' : 'Operator'}</small>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              id="admin-logout"
              onClick={() => api('POST', '/auth/logout').finally(() => setSessionState(null))}
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="admin-main">{page}</main>
      </div>
    </SessionContext.Provider>
  );
};
