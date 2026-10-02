import React, { useState } from 'react';
import { useSession } from '../session';
import { api, errorMessage, formatDateTime } from '../api';
import { Badge, Card, ErrorNote, useLoad } from '../ui';
import type { TabProps } from './types';

interface Overview {
  health: string;
  connection: {
    status: string;
    credentialPrefix: string | null;
    cafeInstanceId: string | null;
    connectorVersion: string | null;
    cafeAppVersion: string | null;
    pairedAt: string | null;
    lastSeenAt: string | null;
    pairingExpiresAt: string | null;
  } | null;
  catalog: { syncedAt: string; cafeVersion: string | null; categories: number; products: number } | null;
  tables: { count: number; syncedAt: string | null };
  queue: Record<string, number>;
  events: { level: string; kind: string; detail: Record<string, unknown>; at: string }[];
}

export const IntegrationTab: React.FC<TabProps> = ({ tenant }) => {
  const { isSuper } = useSession();
  const { data, error, reload } = useLoad(() => api<Overview>('GET', `/tenants/${tenant.tenantId}/integration`), [tenant.tenantId]);
  const [pairing, setPairing] = useState<{ pairingCode: string; expiresAt: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="muted">Loading…</p>;
  const c = data.connection;

  return (
    <div className="tab-body">
      <Card title="INBYTE Café connection" actions={<Badge value={data.health} />} id="integration-status">
        <p className="muted">
          The café’s INBYTE Café POS connects outbound to the platform (no inbound access to the café, no database exposure). It sends its catalog and tables,
          picks up customer orders, creates them in its own order engine and reports their status.
        </p>
        {c ? (
          <dl className="facts">
            <dt>Status</dt>
            <dd>{c.status.toLowerCase().replaceAll('_', ' ')}</dd>
            <dt>Credential</dt>
            <dd className="mono">{c.credentialPrefix ? `${c.credentialPrefix}…` : '—'}</dd>
            <dt>Café installation</dt>
            <dd className="mono">{c.cafeInstanceId ?? '—'}</dd>
            <dt>Versions</dt>
            <dd>
              connector {c.connectorVersion ?? '—'} · INBYTE Café {c.cafeAppVersion ?? '—'}
            </dd>
            <dt>Paired</dt>
            <dd>{formatDateTime(c.pairedAt)}</dd>
            <dt>Last seen</dt>
            <dd id="integration-last-seen">{formatDateTime(c.lastSeenAt)}</dd>
          </dl>
        ) : (
          <p>Not connected.</p>
        )}
        {pairing && (
          <div className="pairing-box" id="pairing-box">
            <p>Enter this one-time pairing code in the café’s INBYTE Café connector:</p>
            <p className="pairing-code mono" id="pairing-code">
              {pairing.pairingCode}
            </p>
            <p className="muted">Valid until {formatDateTime(pairing.expiresAt)}. It is shown only once.</p>
          </div>
        )}
        <ErrorNote message={actionError} />
        {isSuper && (
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-primary"
              id="issue-pairing-code"
              onClick={async () => {
                if (c?.status === 'ACTIVE' && !window.confirm('This disconnects the current INBYTE Café connection. Continue?')) return;
                try {
                  setPairing(await api('POST', `/tenants/${tenant.tenantId}/integration/pairing-code`));
                  setActionError(null);
                  reload();
                } catch (e) {
                  setActionError(errorMessage(e));
                }
              }}
            >
              {c?.status === 'ACTIVE' ? 'Re-pair (new code)' : 'Generate pairing code'}
            </button>
            {c && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (!window.confirm('Revoke this connection? The café stops receiving online orders until it is paired again.')) return;
                  try {
                    await api('POST', `/tenants/${tenant.tenantId}/integration/revoke`);
                    setPairing(null);
                    reload();
                  } catch (e) {
                    setActionError(errorMessage(e));
                  }
                }}
              >
                Revoke
              </button>
            )}
          </div>
        )}
      </Card>

      <Card title="Sync state">
        <dl className="facts">
          <dt>Catalog</dt>
          <dd>{data.catalog ? `${data.catalog.products} products, ${data.catalog.categories} categories — ${formatDateTime(data.catalog.syncedAt)}` : 'never synced'}</dd>
          <dt>Tables</dt>
          <dd>{data.tables.syncedAt ? `${data.tables.count} — ${formatDateTime(data.tables.syncedAt)}` : 'never synced'}</dd>
          <dt>Orders waiting for the café</dt>
          <dd id="integration-queue">
            {data.queue.QUEUED ?? 0} queued · {data.queue.LEASED ?? 0} being delivered
          </dd>
        </dl>
      </Card>

      <Card title="Recent events" actions={<button type="button" className="btn btn-ghost btn-small" onClick={reload}>Refresh</button>}>
        <table className="table table-compact">
          <tbody>
            {data.events.map((e, i) => (
              <tr key={i}>
                <td className="muted">{formatDateTime(e.at)}</td>
                <td>
                  <span className={`badge badge-${e.level === 'INFO' ? 'muted' : e.level === 'WARN' ? 'warn' : 'bad'}`}>{e.level.toLowerCase()}</span>
                </td>
                <td className="mono">{e.kind}</td>
                <td className="mono small">{Object.keys(e.detail).length ? JSON.stringify(e.detail) : ''}</td>
              </tr>
            ))}
            {data.events.length === 0 && (
              <tr>
                <td className="muted">No events.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
