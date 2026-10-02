import React, { useState } from 'react';
import { navigate, useSession } from '../session';
import { api, formatDateTime } from '../api';
import { Badge, Card, ColorInput, ErrorNote, SaveBar, TextInput, useLoad, useSave } from '../ui';

interface CafeRow {
  tenantId: string;
  displayName: string;
  status: string;
  primaryHost: string | null;
  onlineOrdering: boolean;
  integration: string;
  catalogSyncedAt: string | null;
  productCount: number;
}

const NewCafeForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [form, setForm] = useState({ tenantId: '', displayName: '', currencyCode: 'EGP', currencySymbol: 'ج.م', primaryColor: '#c8963e' });
  const save = useSave();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      id="new-cafe-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save.run(() => api('POST', '/tenants', form))) {
          onCreated();
          navigate(`cafes/${form.tenantId}/overview`);
        }
      }}
    >
      <div className="form-grid">
        <TextInput label="Café name" name="displayName" value={form.displayName} onChange={set('displayName')} required />
        <TextInput
          label="Tenant ID"
          name="tenantId"
          value={form.tenantId}
          onChange={(v) => set('tenantId')(v.toLowerCase())}
          hint="Permanent. Lowercase letters, digits, - and _ (e.g. cafe-x)."
          required
        />
        <TextInput label="Currency code" name="currencyCode" value={form.currencyCode} onChange={(v) => set('currencyCode')(v.toUpperCase())} hint="ISO 4217, e.g. EGP" />
        <TextInput label="Currency symbol" name="currencySymbol" value={form.currencySymbol} onChange={set('currencySymbol')} />
        <ColorInput label="Brand colour" value={form.primaryColor} onChange={set('primaryColor')} />
      </div>
      <SaveBar state={save.state} label="Create café" note="New cafés start as DRAFT and are invisible to customers until activated." />
    </form>
  );
};

export const CafesPage: React.FC = () => {
  const { isSuper } = useSession();
  const { data, error, reload } = useLoad(() => api<{ tenants: CafeRow[] }>('GET', '/tenants'), []);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <header className="page-head">
        <h1>Cafés</h1>
        {isSuper && (
          <button type="button" className="btn btn-primary" id="new-cafe-button" onClick={() => setCreating((c) => !c)}>
            {creating ? 'Cancel' : 'New café'}
          </button>
        )}
      </header>
      {creating && (
        <Card title="Create café">
          <NewCafeForm onCreated={reload} />
        </Card>
      )}
      <ErrorNote message={error} />
      <Card>
        <table className="table" id="cafes-table">
          <thead>
            <tr>
              <th>Café</th>
              <th>Status</th>
              <th>POS connection</th>
              <th>Menu</th>
              <th>Domain</th>
            </tr>
          </thead>
          <tbody>
            {data?.tenants.map((t) => (
              <tr key={t.tenantId} data-tenant={t.tenantId}>
                <td>
                  <a href={`#/cafes/${t.tenantId}/overview`}>
                    <strong>{t.displayName}</strong>
                  </a>
                  <div className="muted mono">{t.tenantId}</div>
                </td>
                <td>
                  <Badge value={t.status} />
                  {!t.onlineOrdering && <div className="muted">browse only</div>}
                </td>
                <td>
                  <Badge value={t.integration} />
                </td>
                <td>
                  {t.catalogSyncedAt ? `${t.productCount} products` : <span className="muted">not synced</span>}
                  <div className="muted">{t.catalogSyncedAt ? formatDateTime(t.catalogSyncedAt) : ''}</div>
                </td>
                <td className="mono">{t.primaryHost ?? '—'}</td>
              </tr>
            ))}
            {data && data.tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No cafés yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
};
