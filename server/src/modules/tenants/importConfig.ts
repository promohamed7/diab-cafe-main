// Migration path from the static `/tenants/<id>.json` files of the previous
// frontend-only release: a static config is validated by the website's parser
// and imported into the database section by section (as DRAFT, so an admin
// reviews it before it goes live).

import { parseTenantConfig } from '../../../../src/tenant/parseTenantConfig.ts';
import type { TenantConfig } from '../../../../src/types/tenant.ts';
import type { Db } from '../../db/pool.ts';
import type { Actor } from '../audit/audit.ts';
import type { SectionName } from './tenantSchemas.ts';
import type { TenantRecord } from './tenantService.ts';
import { createTenant, findTenant, updateSection } from './tenantService.ts';

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function sectionsFromConfig(cfg: TenantConfig): Record<SectionName, unknown> {
  return {
    general: { displayName: cfg.identity.displayName, locale: cfg.locale, currencyCode: cfg.currency.code, currencySymbol: cfg.currency.symbol },
    identity: json({
      businessName: cfg.identity.businessName,
      tagline: cfg.identity.tagline,
      description: cfg.identity.description,
      logoUrl: cfg.identity.logoUrl,
      faviconUrl: cfg.identity.faviconUrl
    }),
    branding: json({
      colors: cfg.branding.colors,
      lightColors: cfg.branding.lightColors,
      surfaces: cfg.branding.surfaces,
      defaultTheme: cfg.branding.defaultTheme,
      fontFamily: cfg.branding.fontFamily,
      fontStylesheetUrl: cfg.branding.fontStylesheetUrl
    }),
    contact: json({ ...cfg.contact, businessHoursText: cfg.businessHoursText }),
    website: json(cfg.content),
    ordering: {
      onlineOrdering: cfg.features.onlineOrdering,
      pickup: cfg.features.pickup,
      delivery: cfg.features.delivery,
      dineInQr: cfg.features.dineInQr,
      paymentMethods: cfg.paymentMethods,
      minimumOrderCents: cfg.ordering.minimumOrderCents,
      deliveryAreaText: cfg.ordering.deliveryAreaText,
      offlineOrderPolicy: 'REJECT',
      queueTtlMinutes: 15
    }
  };
}

export async function importTenantConfig(db: Db, actor: Actor, raw: unknown, tenantId: string): Promise<TenantRecord> {
  const cfg = parseTenantConfig(raw, tenantId);
  if (!(await findTenant(db, tenantId))) {
    await createTenant(db, actor, {
      tenantId,
      displayName: cfg.identity.displayName,
      currencyCode: /^[A-Z]{3}$/.test(cfg.currency.code) ? cfg.currency.code : 'EGP',
      currencySymbol: cfg.currency.symbol,
      locale: /^[a-z]{2}(-[A-Z]{2})?$/.test(cfg.locale) ? cfg.locale : 'ar-EG',
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(cfg.branding.colors.primary) ? cfg.branding.colors.primary : '#c8963e'
    });
  }
  let record: TenantRecord | null = null;
  for (const [section, body] of Object.entries(sectionsFromConfig(cfg)) as [SectionName, unknown][]) {
    record = await updateSection(db, actor, tenantId, section, body);
  }
  return record as TenantRecord;
}
