import React from 'react';
import { useSession } from '../session';
import { api } from '../api';
import { Badge, ErrorNote, useLoad, useSave } from '../ui';
import { OverviewTab } from '../cafe/OverviewTab';
import { BrandingTab } from '../cafe/BrandingTab';
import { WebsiteTab } from '../cafe/WebsiteTab';
import { OrderingTab } from '../cafe/OrderingTab';
import { MenuTab } from '../cafe/MenuTab';
import { TablesTab } from '../cafe/TablesTab';
import { OrdersTab } from '../cafe/OrdersTab';
import { IntegrationTab } from '../cafe/IntegrationTab';
import type { TenantDetail } from '../cafe/types';

const TABS = [
  ['overview', 'Overview'],
  ['branding', 'Branding'],
  ['website', 'Website'],
  ['ordering', 'Ordering'],
  ['menu', 'Menu'],
  ['tables', 'Tables / QR'],
  ['orders', 'Orders'],
  ['integration', 'Integration']
] as const;

export const CafeWorkspace: React.FC<{ tenantId: string; tab: string }> = ({ tenantId, tab }) => {
  const { isSuper } = useSession();
  const { data: tenant, error, reload } = useLoad(() => api<TenantDetail>('GET', `/tenants/${encodeURIComponent(tenantId)}`), [tenantId]);
  const status = useSave();

  if (error) return <ErrorNote message={error} />;
  if (!tenant) return <p className="muted">Loading…</p>;

  const setStatus = (next: string) => status.run(() => api('PUT', `/tenants/${tenantId}/status`, { status: next })).then((ok) => ok && reload());
  const props = { tenant, reload };

  return (
    <>
      <header className="page-head">
        <div>
          <a href="#/cafes" className="muted">
            ← Cafés
          </a>
          <h1 id="cafe-title">
            {tenant.displayName} <Badge value={tenant.status} />
          </h1>
          <p className="muted mono">
            {tenant.tenantId} ·{' '}
            <a href={tenant.siteUrl} target="_blank" rel="noopener noreferrer" id="cafe-site-link">
              {tenant.siteUrl}
            </a>
          </p>
          {!tenant.configValid && <p className="save-error">The configuration is incomplete; fix it before activating.</p>}
        </div>
        {isSuper && (
          <div className="card-actions">
            {tenant.status !== 'ACTIVE' && (
              <button type="button" className="btn btn-primary" id="activate-cafe" onClick={() => setStatus('ACTIVE')}>
                Activate
              </button>
            )}
            {tenant.status === 'ACTIVE' && (
              <button type="button" className="btn btn-danger" id="disable-cafe" onClick={() => setStatus('DISABLED')}>
                Disable
              </button>
            )}
            {tenant.status === 'DISABLED' && (
              <button type="button" className="btn btn-ghost" onClick={() => setStatus('DRAFT')}>
                Back to draft
              </button>
            )}
          </div>
        )}
      </header>
      {status.state.status === 'error' && <ErrorNote message={status.state.message} />}

      <nav className="tabs" aria-label="Café sections">
        {TABS.map(([key, label]) => (
          <a key={key} href={`#/cafes/${tenantId}/${key}`} className={tab === key ? 'is-active' : ''} data-tab={key}>
            {label}
          </a>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab {...props} />}
      {tab === 'branding' && <BrandingTab {...props} />}
      {tab === 'website' && <WebsiteTab {...props} />}
      {tab === 'ordering' && <OrderingTab {...props} />}
      {tab === 'menu' && <MenuTab {...props} />}
      {tab === 'tables' && <TablesTab {...props} />}
      {tab === 'orders' && <OrdersTab {...props} />}
      {tab === 'integration' && <IntegrationTab {...props} />}
    </>
  );
};
