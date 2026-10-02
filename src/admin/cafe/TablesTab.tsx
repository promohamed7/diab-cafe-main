import React from 'react';
import { api, formatDateTime } from '../api';
import { Card, ErrorNote, useLoad, useSave } from '../ui';
import type { TabProps } from './types';

interface Table {
  tableId: number;
  label: string;
  qrToken: string;
  isActive: boolean;
  qrEnabled: boolean;
  syncedAt: string;
  qrUrl: string;
}

export const TablesTab: React.FC<TabProps> = ({ tenant }) => {
  const { data, error, reload } = useLoad(() => api<{ siteUrl: string; tables: Table[] }>('GET', `/tenants/${tenant.tenantId}/tables`), [tenant.tenantId]);
  const save = useSave();
  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="tab-body">
      <Card title="Tables and QR codes">
        <p className="muted">
          Tables and their QR tokens are created in INBYTE Café and synced here — the platform never invents a table or a token. Print each QR below; a token only
          works for this café. Switching a QR off stops dine-in orders from that table immediately (Café’s own table settings still apply).
        </p>
        {!tenant.features.dineInQr && <p className="save-error">Dine-in QR ordering is switched off in the Ordering tab.</p>}
        {save.state.status === 'error' && <ErrorNote message={save.state.message} />}
        {data.tables.length === 0 ? (
          <p className="muted" id="tables-empty">
            No tables synced yet.
          </p>
        ) : (
          <div className="qr-grid" id="tables-grid">
            {data.tables.map((t) => (
              <article key={t.tableId} className={`qr-card ${t.isActive && t.qrEnabled ? '' : 'is-off'}`} data-table={t.tableId}>
                <img src={`/api/admin/v1/tenants/${encodeURIComponent(tenant.tenantId)}/tables/${t.tableId}/qr.svg`} alt={`QR code for ${t.label}`} width={160} height={160} />
                <h3>{t.label}</h3>
                <p className="mono small">{t.qrUrl}</p>
                {!t.isActive && <span className="badge badge-bad">Inactive in Café</span>}
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={t.qrEnabled}
                    onChange={(e) => save.run(() => api('PUT', `/tenants/${tenant.tenantId}/tables/${t.tableId}`, { qrEnabled: e.target.checked })).then(reload)}
                  />{' '}
                  QR ordering enabled
                </label>
                <div className="card-actions">
                  <a className="btn btn-small btn-ghost" href={`/api/admin/v1/tenants/${encodeURIComponent(tenant.tenantId)}/tables/${t.tableId}/qr.svg`} download={`qr-${tenant.tenantId}-${t.tableId}.svg`}>
                    Download SVG
                  </a>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => navigator.clipboard?.writeText(t.qrUrl)}>
                    Copy link
                  </button>
                </div>
                <small className="muted">Synced {formatDateTime(t.syncedAt)}</small>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
