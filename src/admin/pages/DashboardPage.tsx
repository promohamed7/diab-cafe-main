import React from 'react';
import { api } from '../api';
import { Badge, Card, ErrorNote, useLoad } from '../ui';

interface Dashboard {
  cafes: { total: number; active: number; draft: number; disabled: number };
  integrations: { online: number; offline: number; notConnected: number };
  orders: { last24h: number; awaitingCafe: number; notDelivered24h: number };
  attention: { tenantId: string; displayName: string; integration: string }[];
}

const Stat: React.FC<{ label: string; value: number; tone?: 'ok' | 'warn' | 'bad'; id?: string }> = ({ label, value, tone, id }) => (
  <div className={`stat ${tone ? `stat-${tone}` : ''}`} id={id}>
    <span className="stat-value">{value}</span>
    <span className="stat-label">{label}</span>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { data, error } = useLoad(() => api<Dashboard>('GET', '/dashboard'), []);
  return (
    <>
      <header className="page-head">
        <h1>Dashboard</h1>
      </header>
      <ErrorNote message={error} />
      {data && (
        <>
          <div className="stat-grid">
            <Stat label="Active cafés" value={data.cafes.active} id="stat-active-cafes" />
            <Stat label="Draft" value={data.cafes.draft} />
            <Stat label="Disabled" value={data.cafes.disabled} />
            <Stat label="POS connected" value={data.integrations.online} tone="ok" id="stat-online" />
            <Stat label="POS offline" value={data.integrations.offline} tone={data.integrations.offline ? 'bad' : undefined} />
            <Stat label="Orders (24 h)" value={data.orders.last24h} id="stat-orders" />
            <Stat label="Awaiting café" value={data.orders.awaitingCafe} tone={data.orders.awaitingCafe ? 'warn' : undefined} />
            <Stat label="Not delivered (24 h)" value={data.orders.notDelivered24h} tone={data.orders.notDelivered24h ? 'bad' : undefined} />
          </div>
          <Card title="Needs attention">
            {data.attention.length === 0 ? (
              <p className="muted">Every active café is connected to its INBYTE Café POS.</p>
            ) : (
              <ul className="plain-list">
                {data.attention.map((t) => (
                  <li key={t.tenantId}>
                    <a href={`#/cafes/${t.tenantId}/integration`}>{t.displayName}</a> <Badge value={t.integration} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
};
