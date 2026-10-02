import React, { useState } from 'react';
import { api, formatDateTime } from '../api';
import { Card, ErrorNote, useLoad } from '../ui';

interface Entry {
  id: number;
  createdAt: string;
  actorType: string;
  actorLabel: string | null;
  tenantId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
}

export const AuditPage: React.FC = () => {
  const [tenant, setTenant] = useState('');
  const [applied, setApplied] = useState('');
  const { data, error } = useLoad(() => api<{ entries: Entry[] }>('GET', `/audit?limit=200${applied ? `&tenantId=${encodeURIComponent(applied)}` : ''}`), [applied]);
  return (
    <>
      <header className="page-head">
        <h1>Audit log</h1>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(tenant.trim());
          }}
        >
          <input placeholder="Filter by tenant ID" value={tenant} onChange={(e) => setTenant(e.target.value)} aria-label="Filter by tenant ID" />
          <button type="submit" className="btn btn-ghost btn-small">
            Filter
          </button>
        </form>
      </header>
      <ErrorNote message={error} />
      <Card>
        <table className="table table-compact" id="audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Café</th>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id}>
                <td className="muted">{formatDateTime(e.createdAt)}</td>
                <td>
                  {e.actorLabel ?? '—'} <span className="muted">({e.actorType.toLowerCase()})</span>
                </td>
                <td className="mono">{e.tenantId ?? '—'}</td>
                <td className="mono">{e.action}</td>
                <td className="mono small">{e.targetType ? `${e.targetType}:${e.targetId ?? ''}` : ''}</td>
                <td className="mono small">{Object.keys(e.detail).length ? JSON.stringify(e.detail) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
};
