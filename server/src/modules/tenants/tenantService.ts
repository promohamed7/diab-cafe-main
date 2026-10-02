// Cafés (tenants): persistence, configuration sections and the public
// configuration document consumed by the customer website.

import type { z } from 'zod';
import { parseTenantConfig } from '../../../../src/tenant/parseTenantConfig.ts';
import type { TenantConfig } from '../../../../src/types/tenant.ts';
import type { Db, Queryable } from '../../db/pool.ts';
import { isUniqueViolation, withTx } from '../../db/pool.ts';
import { ApiError, badRequest, conflict, notFound } from '../../http/errors.ts';
import type { Actor } from '../audit/audit.ts';
import { writeAudit } from '../audit/audit.ts';
import type { SectionName } from './tenantSchemas.ts';
import { SECTION_SCHEMAS, createTenantSchema, domainSchema } from './tenantSchemas.ts';

export type TenantStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED';

export interface TenantRecord {
  /** Internal row id. Never sent to customers. */
  uuid: string;
  tenantId: string;
  status: TenantStatus;
  displayName: string;
  locale: string;
  currencyCode: string;
  currencySymbol: string;
  identity: Record<string, any>;
  branding: Record<string, any>;
  contact: Record<string, any>;
  content: Record<string, any>;
  businessHoursText: string | null;
  features: { onlineOrdering: boolean; pickup: boolean; delivery: boolean; dineInQr: boolean };
  paymentMethods: string[];
  minimumOrderCents: number | null;
  deliveryAreaText: string | null;
  offlineOrderPolicy: 'REJECT' | 'QUEUE';
  queueTtlMinutes: number;
  configVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toTenantRecord(r: Record<string, any>): TenantRecord {
  return {
    uuid: r.id,
    tenantId: r.tenant_key,
    status: r.status,
    displayName: r.display_name,
    locale: r.locale,
    currencyCode: r.currency_code,
    currencySymbol: r.currency_symbol,
    identity: r.identity,
    branding: r.branding,
    contact: r.contact,
    content: r.content,
    businessHoursText: r.business_hours_text,
    features: {
      onlineOrdering: r.online_ordering,
      pickup: r.pickup_enabled,
      delivery: r.delivery_enabled,
      dineInQr: r.dine_in_qr_enabled
    },
    paymentMethods: r.payment_methods,
    minimumOrderCents: r.minimum_order_cents,
    deliveryAreaText: r.delivery_area_text,
    offlineOrderPolicy: r.offline_order_policy,
    queueTtlMinutes: r.queue_ttl_minutes,
    configVersion: r.config_version,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString()
  };
}

export async function findTenant(db: Queryable, tenantKey: string): Promise<TenantRecord | null> {
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(tenantKey)) return null;
  const { rows } = await db.query('SELECT * FROM tenants WHERE tenant_key = $1', [tenantKey]);
  return rows[0] ? toTenantRecord(rows[0]) : null;
}

/** Admin lookup: any status. */
export async function requireTenant(db: Queryable, tenantKey: string): Promise<TenantRecord> {
  const t = await findTenant(db, tenantKey);
  if (!t) throw notFound('TENANT_NOT_FOUND');
  return t;
}

/** Public lookup: only ACTIVE cafés exist for customers. Draft/disabled look exactly like unknown. */
export async function requirePublicTenant(db: Queryable, tenantKey: string): Promise<TenantRecord> {
  const t = await findTenant(db, tenantKey);
  if (!t || t.status !== 'ACTIVE') throw notFound('TENANT_NOT_FOUND');
  return t;
}

/** The customer-facing configuration, passed through the website's own allow-list parser. */
export function buildPublicConfig(t: TenantRecord): TenantConfig {
  const raw = {
    tenantId: t.tenantId,
    slug: t.tenantId,
    locale: t.locale,
    identity: { ...t.identity, displayName: t.displayName },
    branding: t.branding,
    contact: t.contact,
    businessHoursText: t.businessHoursText,
    features: t.features,
    ordering: { minimumOrderCents: t.minimumOrderCents, deliveryAreaText: t.deliveryAreaText },
    paymentMethods: t.paymentMethods,
    currency: { code: t.currencyCode, symbol: t.currencySymbol },
    content: t.content
  };
  return parseTenantConfig(raw, t.tenantId);
}

export async function listTenants(db: Queryable, offlineAfterSeconds: number, now: Date) {
  const { rows } = await db.query(
    `SELECT t.*, c.status AS connection_status, c.last_seen_at,
            (SELECT host FROM tenant_domains d WHERE d.tenant_id = t.id AND d.is_primary) AS primary_host,
            s.synced_at AS catalog_synced_at, s.product_count
       FROM tenants t
       LEFT JOIN integration_connections c ON c.tenant_id = t.id AND c.status <> 'REVOKED'
       LEFT JOIN catalog_sync_state s ON s.tenant_id = t.id
      ORDER BY t.display_name`
  );
  return rows.map((r) => ({
    tenantId: r.tenant_key,
    displayName: r.display_name,
    status: r.status as TenantStatus,
    primaryHost: r.primary_host as string | null,
    onlineOrdering: r.online_ordering as boolean,
    integration: connectionHealth(r.connection_status, r.last_seen_at, offlineAfterSeconds, now),
    catalogSyncedAt: r.catalog_synced_at ? r.catalog_synced_at.toISOString() : null,
    productCount: r.product_count ?? 0,
    updatedAt: r.updated_at.toISOString()
  }));
}

export type ConnectionHealth = 'NOT_CONNECTED' | 'PENDING_PAIRING' | 'ONLINE' | 'OFFLINE';

export function connectionHealth(status: string | null, lastSeen: Date | null, offlineAfterSeconds: number, now: Date): ConnectionHealth {
  if (!status || status === 'REVOKED') return 'NOT_CONNECTED';
  if (status === 'PENDING_PAIRING') return 'PENDING_PAIRING';
  return lastSeen && now.getTime() - lastSeen.getTime() <= offlineAfterSeconds * 1000 ? 'ONLINE' : 'OFFLINE';
}

export async function createTenant(db: Db, actor: Actor, input: z.infer<typeof createTenantSchema>): Promise<TenantRecord> {
  return withTx(db, async (client) => {
    let row: Record<string, any>;
    try {
      const res = await client.query(
        `INSERT INTO tenants (tenant_key, display_name, locale, currency_code, currency_symbol, branding, identity)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          input.tenantId,
          input.displayName,
          input.locale,
          input.currencyCode,
          input.currencySymbol,
          JSON.stringify({ colors: { primary: input.primaryColor }, defaultTheme: 'dark' }),
          JSON.stringify({ businessName: input.displayName })
        ]
      );
      row = res.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('CONFLICT');
      throw error;
    }
    await writeAudit(client, actor, { action: 'tenant.created', tenantId: row.id, targetType: 'tenant', targetId: input.tenantId });
    return toTenantRecord(row);
  });
}

/** Applies one configuration section. The result must still produce a valid public config. */
export async function updateSection(
  db: Db,
  actor: Actor,
  tenantKey: string,
  section: SectionName,
  body: unknown
): Promise<TenantRecord> {
  const schema = SECTION_SCHEMAS[section];
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('VALIDATION_FAILED', [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(root)'))]);
  }
  const v = parsed.data as Record<string, any>;

  return withTx(db, async (client) => {
    const current = await client.query('SELECT * FROM tenants WHERE tenant_key = $1 FOR UPDATE', [tenantKey]);
    if (!current.rows[0]) throw notFound('TENANT_NOT_FOUND');
    const id = current.rows[0].id;
    let sql: string;
    let params: unknown[];
    switch (section) {
      case 'general':
        sql = 'UPDATE tenants SET display_name = $2, locale = $3, currency_code = $4, currency_symbol = $5';
        params = [id, v.displayName, v.locale, v.currencyCode, v.currencySymbol];
        break;
      case 'identity':
        sql = 'UPDATE tenants SET identity = $2';
        params = [id, JSON.stringify(v)];
        break;
      case 'branding':
        sql = 'UPDATE tenants SET branding = $2';
        params = [id, JSON.stringify(stripNulls(v))];
        break;
      case 'contact': {
        const { businessHoursText, ...contact } = v;
        sql = 'UPDATE tenants SET contact = $2, business_hours_text = $3';
        params = [id, JSON.stringify(contact), businessHoursText];
        break;
      }
      case 'website':
        sql = 'UPDATE tenants SET content = $2';
        params = [id, JSON.stringify(v)];
        break;
      case 'ordering':
        sql = `UPDATE tenants SET online_ordering = $2, pickup_enabled = $3, delivery_enabled = $4, dine_in_qr_enabled = $5,
               payment_methods = $6, minimum_order_cents = $7, delivery_area_text = $8, offline_order_policy = $9, queue_ttl_minutes = $10`;
        params = [
          id,
          v.onlineOrdering,
          v.pickup,
          v.delivery,
          v.dineInQr,
          [...new Set(v.paymentMethods as string[])],
          v.minimumOrderCents || null,
          v.deliveryAreaText,
          v.offlineOrderPolicy,
          v.queueTtlMinutes
        ];
        break;
    }
    const { rows } = await client.query(
      `${sql}, config_version = config_version + 1, updated_at = now() WHERE id = $1 RETURNING *`,
      params
    );
    const record = toTenantRecord(rows[0]);
    try {
      buildPublicConfig(record);
    } catch {
      throw badRequest('VALIDATION_FAILED', [section]);
    }
    await writeAudit(client, actor, {
      action: `tenant.${section}.updated`,
      tenantId: id,
      targetType: 'tenant',
      targetId: tenantKey,
      detail: section === 'ordering' || section === 'general' ? { values: v } : {}
    });
    return record;
  });
}

function stripNulls(v: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined));
}

export async function setTenantStatus(db: Db, actor: Actor, tenantKey: string, status: TenantStatus): Promise<TenantRecord> {
  return withTx(db, async (client) => {
    const { rows } = await client.query(
      'UPDATE tenants SET status = $2, updated_at = now() WHERE tenant_key = $1 RETURNING *',
      [tenantKey, status]
    );
    if (!rows[0]) throw notFound('TENANT_NOT_FOUND');
    if (status === 'ACTIVE') {
      try {
        buildPublicConfig(toTenantRecord(rows[0]));
      } catch {
        throw new ApiError(422, 'VALIDATION_FAILED', ['configuration']);
      }
    }
    await writeAudit(client, actor, { action: `tenant.status.${status.toLowerCase()}`, tenantId: rows[0].id, targetType: 'tenant', targetId: tenantKey });
    return toTenantRecord(rows[0]);
  });
}

// ---- Domains ---------------------------------------------------------------

export async function listDomains(db: Queryable, tenantUuid: string) {
  const { rows } = await db.query('SELECT host, is_primary, created_at FROM tenant_domains WHERE tenant_id = $1 ORDER BY host', [tenantUuid]);
  return rows.map((r) => ({ host: r.host as string, isPrimary: r.is_primary as boolean, createdAt: r.created_at.toISOString() }));
}

export async function addDomain(db: Db, actor: Actor, tenant: TenantRecord, body: unknown) {
  const parsed = domainSchema.safeParse(body);
  if (!parsed.success) throw badRequest('VALIDATION_FAILED', ['host']);
  const { host, isPrimary } = parsed.data;
  await withTx(db, async (client) => {
    if (isPrimary) await client.query('UPDATE tenant_domains SET is_primary = false WHERE tenant_id = $1', [tenant.uuid]);
    try {
      await client.query('INSERT INTO tenant_domains (host, tenant_id, is_primary) VALUES ($1, $2, $3)', [host, tenant.uuid, isPrimary]);
    } catch (error) {
      // The host already belongs to a café (maybe another one): never reassign silently.
      if (isUniqueViolation(error)) throw conflict('CONFLICT');
      throw error;
    }
    await writeAudit(client, actor, { action: 'tenant.domain.added', tenantId: tenant.uuid, targetType: 'domain', targetId: host });
  });
  return listDomains(db, tenant.uuid);
}

export async function removeDomain(db: Db, actor: Actor, tenant: TenantRecord, host: string) {
  await withTx(db, async (client) => {
    const res = await client.query('DELETE FROM tenant_domains WHERE host = $1 AND tenant_id = $2', [host.toLowerCase(), tenant.uuid]);
    if (res.rowCount === 0) throw notFound();
    await writeAudit(client, actor, { action: 'tenant.domain.removed', tenantId: tenant.uuid, targetType: 'domain', targetId: host });
  });
  return listDomains(db, tenant.uuid);
}

/** Hostname → ACTIVE café. */
export async function tenantForHost(db: Queryable, host: string): Promise<string | null> {
  const { rows } = await db.query(
    `SELECT t.tenant_key FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.host = $1 AND t.status = 'ACTIVE'`,
    [host.toLowerCase()]
  );
  return rows[0]?.tenant_key ?? null;
}

/** Any café that owns this host, whatever its status (used to bind requests to their domain). */
export async function ownerOfHost(db: Queryable, host: string): Promise<string | null> {
  const { rows } = await db.query(
    'SELECT t.tenant_key FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.host = $1',
    [host.toLowerCase()]
  );
  return rows[0]?.tenant_key ?? null;
}

/** Website URL printed in QR codes and shown in the admin. */
export async function siteUrlFor(db: Queryable, tenant: TenantRecord, template: string, origin: string): Promise<string> {
  const { rows } = await db.query('SELECT host FROM tenant_domains WHERE tenant_id = $1 AND is_primary', [tenant.uuid]);
  if (rows[0]) return `https://${rows[0].host}/`;
  return template.replaceAll('{origin}', origin).replaceAll('{tenantId}', tenant.tenantId);
}
