import React, { useState } from 'react';
import { useSession } from '../session';
import { api } from '../api';
import { Card, SaveBar, TextArea, TextInput, Toggle, orNull, useSave } from '../ui';
import type { TabProps } from './types';
import { sectionPath } from './types';

export const OverviewTab: React.FC<TabProps> = ({ tenant, reload }) => {
  const { isSuper } = useSession();
  const [general, setGeneral] = useState({
    displayName: tenant.displayName,
    locale: tenant.locale,
    currencyCode: tenant.currencyCode,
    currencySymbol: tenant.currencySymbol
  });
  const [identity, setIdentity] = useState({
    businessName: tenant.identity.businessName ?? '',
    tagline: tenant.identity.tagline ?? '',
    description: tenant.identity.description ?? '',
    logoUrl: tenant.identity.logoUrl ?? '',
    faviconUrl: tenant.identity.faviconUrl ?? ''
  });
  const [domain, setDomain] = useState({ host: '', isPrimary: true });
  const saveGeneral = useSave();
  const saveIdentity = useSave();
  const saveDomain = useSave();

  return (
    <div className="tab-body">
      <Card title="General">
        <form
          id="general-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await saveGeneral.run(() => api('PUT', sectionPath(tenant.tenantId, 'general'), general))) reload();
          }}
        >
          <div className="form-grid">
            <TextInput label="Café name" name="displayName" value={general.displayName} onChange={(v) => setGeneral({ ...general, displayName: v })} disabled={!isSuper} />
            <TextInput label="Locale" value={general.locale} onChange={(v) => setGeneral({ ...general, locale: v })} hint="e.g. ar-EG (dates and numbers)" disabled={!isSuper} />
            <TextInput label="Currency code" value={general.currencyCode} onChange={(v) => setGeneral({ ...general, currencyCode: v.toUpperCase() })} disabled={!isSuper} />
            <TextInput label="Currency symbol" value={general.currencySymbol} onChange={(v) => setGeneral({ ...general, currencySymbol: v })} disabled={!isSuper} />
          </div>
          {isSuper ? <SaveBar state={saveGeneral.state} /> : <p className="muted">Only a super admin can change name and currency.</p>}
        </form>
      </Card>

      <Card title="Identity">
        <form
          id="identity-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = {
              businessName: orNull(identity.businessName),
              tagline: orNull(identity.tagline),
              description: orNull(identity.description),
              logoUrl: orNull(identity.logoUrl),
              faviconUrl: orNull(identity.faviconUrl)
            };
            if (await saveIdentity.run(() => api('PUT', sectionPath(tenant.tenantId, 'identity'), body))) reload();
          }}
        >
          <div className="form-grid">
            <TextInput label="Legal / business name" value={identity.businessName} onChange={(v) => setIdentity({ ...identity, businessName: v })} />
            <TextInput label="Tagline" name="tagline" value={identity.tagline} onChange={(v) => setIdentity({ ...identity, tagline: v })} hint="Shown under the name" />
            <TextInput label="Logo URL" name="logoUrl" value={identity.logoUrl} onChange={(v) => setIdentity({ ...identity, logoUrl: v })} hint="https://… or /path" wide />
            <TextInput label="Favicon URL" value={identity.faviconUrl} onChange={(v) => setIdentity({ ...identity, faviconUrl: v })} wide />
            <TextArea label="Description (page metadata)" value={identity.description} onChange={(v) => setIdentity({ ...identity, description: v })} />
          </div>
          {identity.logoUrl && <img src={identity.logoUrl} alt="Logo preview" className="logo-preview" />}
          <SaveBar state={saveIdentity.state} />
        </form>
      </Card>

      <Card title="Domains">
        <p className="muted">
          Customers reach this café at <a href={tenant.siteUrl}>{tenant.siteUrl}</a>. Add a custom domain or platform subdomain after its DNS points to the INBYTE
          platform; the platform then serves this café on that host (and only this café).
        </p>
        <ul className="plain-list" id="domain-list">
          {tenant.domains.map((d) => (
            <li key={d.host}>
              <span className="mono">{d.host}</span> {d.isPrimary && <span className="badge badge-ok">primary</span>}{' '}
              {isSuper && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => saveDomain.run(() => api('DELETE', `/tenants/${tenant.tenantId}/domains/${encodeURIComponent(d.host)}`)).then((ok) => ok && reload())}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {tenant.domains.length === 0 && <li className="muted">No custom domains.</li>}
        </ul>
        {isSuper && (
          <form
            id="domain-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await saveDomain.run(() => api('POST', `/tenants/${tenant.tenantId}/domains`, domain))) {
                setDomain({ host: '', isPrimary: true });
                reload();
              }
            }}
          >
            <div className="form-grid">
              <TextInput label="Host" name="host" value={domain.host} onChange={(v) => setDomain({ ...domain, host: v })} placeholder="menu.cafe-x.com" />
              <Toggle label="Primary (used in QR codes)" checked={domain.isPrimary} onChange={(v) => setDomain({ ...domain, isPrimary: v })} />
            </div>
            <SaveBar state={saveDomain.state} label="Add domain" />
          </form>
        )}
      </Card>
    </div>
  );
};
