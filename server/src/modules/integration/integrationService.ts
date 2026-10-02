// The formal boundary between the platform and each café's INBYTE Café POS.
//
// The café side runs a connector that makes OUTBOUND HTTPS calls only (the POS
// is offline-first and usually behind NAT; nothing on the internet calls into
// it, and its SQLite database is never exposed). The connector:
//   1. pairs once with a one-time code issued in the INBYTE Admin,
//   2. sends heartbeats,
//   3. pushes catalog and table snapshots (Café is authoritative),
//   4. leases queued orders, creates them in Café's unified order engine
//      (idempotent on clientRequestId), and reports the result,
//   5. reports status changes with a monotonically increasing version.
// The café (tenant) is derived from the credential — never from the request.

import { z } from 'zod';
import type { AppContext } from '../../http/context.ts';
import type { Db, Queryable } from '../../db/pool.ts';
import { withTx } from '../../db/pool.ts';
import { ApiError, notFound } from '../../http/errors.ts';
import { PUBLIC_REFERENCE_PATTERN, newConnectorCredential, newPairingCode, normalizePairingCode, sha256 } from '../../security/tokens.ts';
import type { Actor } from '../audit/audit.ts';
import { writeAudit } from '../audit/audit.ts';
import type { CatalogSnapshot } from '../catalog/catalogService.ts';
import { replaceCatalogSnapshot } from '../catalog/catalogService.ts';
import { recordHistory } from '../orders/orderService.ts';
import type { tablesSnapshotSchema } from '../tables/tableService.ts';
import { replaceTables } from '../tables/tableService.ts';
import type { TenantRecord } from '../tenants/tenantService.ts';
import { connectionHealth } from '../tenants/tenantService.ts';

export const PAIRING_CODE_MINUTES = 15;

export interface ConnectorPrincipal {
  connectionId: string;
  tenantUuid: string;
  tenantId: string;
  tenantStatus: string;
}

export async function logIntegrationEvent(
  db: Queryable,
  tenantUuid: string,
  connectionId: string | null,
  level: 'INFO' | 'WARN' | 'ERROR',
  kind: string,
  detail: Record<string, unknown> = {}
) {
  await db.query('INSERT INTO integration_events (tenant_id, connection_id, level, kind, detail) VALUES ($1, $2, $3, $4, $5)', [
    tenantUuid,
    connectionId,
    level,
    kind,
    JSON.stringify(detail)
  ]);
}

// ---- Admin side ----------------------------------------------------------------

/** Issues a one-time pairing code. Any previous connection of this café is revoked. */
export async function issuePairingCode(ctx: AppContext, actor: Actor, tenant: TenantRecord) {
  const code = newPairingCode();
  const expiresAt = new Date(ctx.now().getTime() + PAIRING_CODE_MINUTES * 60_000);
  await withTx(ctx.db, async (client) => {
    await client.query(`UPDATE integration_connections SET status = 'REVOKED', revoked_at = $2 WHERE tenant_id = $1 AND status <> 'REVOKED'`, [
      tenant.uuid,
      ctx.now()
    ]);
    const { rows } = await client.query(
      `INSERT INTO integration_connections (tenant_id, status, pairing_code_hash, pairing_expires_at, created_by)
       VALUES ($1, 'PENDING_PAIRING', $2, $3, $4) RETURNING id`,
      [tenant.uuid, sha256(normalizePairingCode(code)), expiresAt, actor.id]
    );
    await logIntegrationEvent(client, tenant.uuid, rows[0].id, 'INFO', 'pairing.issued');
    await writeAudit(client, actor, { action: 'integration.pairing_issued', tenantId: tenant.uuid, targetType: 'connection', targetId: rows[0].id });
  });
  return { pairingCode: code, expiresAt: expiresAt.toISOString() };
}

export async function revokeConnection(ctx: AppContext, actor: Actor, tenant: TenantRecord) {
  await withTx(ctx.db, async (client) => {
    const { rows } = await client.query(
      `UPDATE integration_connections SET status = 'REVOKED', revoked_at = $2 WHERE tenant_id = $1 AND status <> 'REVOKED' RETURNING id`,
      [tenant.uuid, ctx.now()]
    );
    if (!rows[0]) throw notFound();
    await logIntegrationEvent(client, tenant.uuid, rows[0].id, 'WARN', 'connection.revoked');
    await writeAudit(client, actor, { action: 'integration.revoked', tenantId: tenant.uuid, targetType: 'connection', targetId: rows[0].id });
  });
}

export async function integrationOverview(ctx: AppContext, tenant: TenantRecord) {
  const now = ctx.now();
  const [conn, events, sync, tables, queue] = await Promise.all([
    ctx.db.query(`SELECT * FROM integration_connections WHERE tenant_id = $1 AND status <> 'REVOKED'`, [tenant.uuid]),
    ctx.db.query('SELECT level, kind, detail, created_at FROM integration_events WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50', [tenant.uuid]),
    ctx.db.query('SELECT * FROM catalog_sync_state WHERE tenant_id = $1', [tenant.uuid]),
    ctx.db.query('SELECT count(*)::int AS n, max(synced_at) AS synced_at FROM cafe_tables WHERE tenant_id = $1', [tenant.uuid]),
    ctx.db.query(
      `SELECT delivery_state, count(*)::int AS n FROM orders WHERE tenant_id = $1 AND delivery_state IN ('QUEUED', 'LEASED') GROUP BY delivery_state`,
      [tenant.uuid]
    )
  ]);
  const c = conn.rows[0];
  return {
    health: connectionHealth(c?.status ?? null, c?.last_seen_at ?? null, ctx.config.connectorOfflineAfterSeconds, now),
    connection: c
      ? {
          status: c.status,
          credentialPrefix: c.credential_prefix,
          cafeInstanceId: c.cafe_instance_id,
          connectorVersion: c.connector_version,
          cafeAppVersion: c.cafe_app_version,
          pairedAt: c.paired_at?.toISOString() ?? null,
          lastSeenAt: c.last_seen_at?.toISOString() ?? null,
          pairingExpiresAt: c.status === 'PENDING_PAIRING' ? c.pairing_expires_at?.toISOString() ?? null : null
        }
      : null,
    catalog: sync.rows[0]
      ? {
          syncedAt: sync.rows[0].synced_at.toISOString(),
          cafeVersion: sync.rows[0].cafe_version,
          categories: sync.rows[0].category_count,
          products: sync.rows[0].product_count
        }
      : null,
    tables: { count: tables.rows[0].n, syncedAt: tables.rows[0].synced_at?.toISOString() ?? null },
    queue: Object.fromEntries(queue.rows.map((r) => [r.delivery_state, r.n])),
    events: events.rows.map((e) => ({ level: e.level, kind: e.kind, detail: e.detail, at: e.created_at.toISOString() }))
  };
}

// ---- Connector side ----------------------------------------------------------------

export const pairSchema = z
  .object({
    pairingCode: z.string().min(8).max(20),
    cafeInstanceId: z.string().trim().min(1).max(100),
    connectorVersion: z.string().trim().min(1).max(40)
  })
  .strict();

export async function pairConnector(ctx: AppContext, input: z.infer<typeof pairSchema>, ip: string | null) {
  const now = ctx.now();
  const { credential, prefix } = newConnectorCredential();
  return withTx(ctx.db, async (client) => {
    const { rows } = await client.query(
      `UPDATE integration_connections c
          SET status = 'ACTIVE', pairing_code_hash = NULL, pairing_expires_at = NULL, credential_hash = $2, credential_prefix = $3,
              cafe_instance_id = $4, connector_version = $5, paired_at = $6, last_seen_at = $6
         FROM tenants t
        WHERE c.tenant_id = t.id AND c.status = 'PENDING_PAIRING' AND c.pairing_code_hash = $1 AND c.pairing_expires_at > $6
        RETURNING c.id, c.tenant_id, t.tenant_key`,
      [sha256(normalizePairingCode(input.pairingCode)), sha256(credential), prefix, input.cafeInstanceId, input.connectorVersion, now]
    );
    const row = rows[0];
    if (!row) throw new ApiError(401, 'INVALID_PAIRING_CODE');
    await logIntegrationEvent(client, row.tenant_id, row.id, 'INFO', 'connector.paired', { cafeInstanceId: input.cafeInstanceId, connectorVersion: input.connectorVersion });
    await writeAudit(
      client,
      { type: 'CONNECTOR', id: row.id, label: `connector ${prefix}`, ip },
      { action: 'integration.paired', tenantId: row.tenant_id, targetType: 'connection', targetId: row.id }
    );
    return { tenantId: row.tenant_key as string, credential };
  });
}

/** Bearer credential → connection. Revoked credentials stop working immediately. */
export async function authenticateConnector(db: Queryable, authorization: string | undefined): Promise<ConnectorPrincipal> {
  const m = /^Bearer (inbc_[A-Za-z0-9_-]{43})$/.exec(authorization ?? '');
  if (!m) throw new ApiError(401, 'INVALID_CREDENTIAL');
  const { rows } = await db.query(
    `SELECT c.id, c.status, c.tenant_id, t.tenant_key, t.status AS tenant_status
       FROM integration_connections c JOIN tenants t ON t.id = c.tenant_id WHERE c.credential_hash = $1`,
    [sha256(m[1])]
  );
  const row = rows[0];
  if (!row) throw new ApiError(401, 'INVALID_CREDENTIAL');
  if (row.status !== 'ACTIVE') throw new ApiError(401, 'CONNECTION_REVOKED');
  return { connectionId: row.id, tenantUuid: row.tenant_id, tenantId: row.tenant_key, tenantStatus: row.tenant_status };
}

export const heartbeatSchema = z.object({
  connectorVersion: z.string().trim().max(40).optional(),
  cafeAppVersion: z.string().trim().max(40).optional()
});

export async function heartbeat(ctx: AppContext, p: ConnectorPrincipal, input: z.infer<typeof heartbeatSchema>) {
  const now = ctx.now();
  await ctx.db.query(
    `UPDATE integration_connections SET last_seen_at = $2, connector_version = COALESCE($3, connector_version),
            cafe_app_version = COALESCE($4, cafe_app_version) WHERE id = $1`,
    [p.connectionId, now, input.connectorVersion ?? null, input.cafeAppVersion ?? null]
  );
  const pending = await ctx.db.query(
    `SELECT count(*)::int AS n FROM orders WHERE tenant_id = $1
        AND ((delivery_state = 'QUEUED' AND deliver_before > $2) OR (delivery_state = 'LEASED' AND lease_expires_at <= $2))`,
    [p.tenantUuid, now]
  );
  return { serverTime: now.toISOString(), tenantId: p.tenantId, pendingOrders: pending.rows[0].n };
}

export async function pushCatalog(ctx: AppContext, p: ConnectorPrincipal, snapshot: CatalogSnapshot) {
  const result = await withTx(ctx.db, async (client) => {
    const counts = await replaceCatalogSnapshot(client, p.tenantUuid, snapshot, ctx.now());
    await client.query('UPDATE integration_connections SET last_seen_at = $2 WHERE id = $1', [p.connectionId, ctx.now()]);
    await logIntegrationEvent(client, p.tenantUuid, p.connectionId, 'INFO', 'catalog.synced', { ...counts, cafeVersion: snapshot.version ?? null });
    return counts;
  });
  return { accepted: true, ...result };
}

export async function pushTables(ctx: AppContext, p: ConnectorPrincipal, snapshot: z.infer<typeof tablesSnapshotSchema>) {
  const result = await withTx(ctx.db, async (client) => {
    const counts = await replaceTables(client, p.tenantUuid, snapshot, ctx.now());
    await logIntegrationEvent(client, p.tenantUuid, p.connectionId, 'INFO', 'tables.synced', counts);
    return counts;
  });
  return { accepted: true, ...result };
}

export const leaseSchema = z.object({ max: z.number().int().min(1).max(50).default(10) });

/**
 * Hands queued orders to the connector. A lease expires; an order whose lease
 * expired (connector crashed before reporting) is handed out again with the
 * SAME clientRequestId, so Café's idempotency returns the existing order
 * instead of creating a second one.
 */
export async function leaseOrders(ctx: AppContext, p: ConnectorPrincipal, max: number) {
  const now = ctx.now();
  const leaseUntil = new Date(now.getTime() + ctx.config.orderLeaseSeconds * 1000);
  const rows = await withTx(ctx.db, async (client) => {
    await client.query('UPDATE integration_connections SET last_seen_at = $2 WHERE id = $1', [p.connectionId, now]);
    const { rows: leased } = await client.query(
      `WITH next AS (
         SELECT id FROM orders
          WHERE tenant_id = $1
            AND ((delivery_state = 'QUEUED' AND deliver_before > $2) OR (delivery_state = 'LEASED' AND lease_expires_at <= $2))
          ORDER BY created_at
          LIMIT $3
          FOR UPDATE SKIP LOCKED)
       UPDATE orders o SET delivery_state = 'LEASED', leased_by = $4, lease_expires_at = $5,
              delivery_attempts = o.delivery_attempts + 1, updated_at = $2
         FROM next WHERE o.id = next.id
       RETURNING o.*`,
      [p.tenantUuid, now, max, p.connectionId, leaseUntil]
    );
    for (const r of leased) if (r.delivery_attempts === 1) await recordHistory(client, r, 'PLATFORM', 'leased to café connector');
    return leased;
  });
  if (rows.length === 0) return { orders: [] };

  const items = await ctx.db.query(
    'SELECT order_id, cafe_product_id, quantity, modifier_option_ids FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY order_id, line_no',
    [rows.map((r) => r.id)]
  );
  const byOrder = new Map<string, { productId: number; quantity: number; modifierOptionIds: number[] }[]>();
  for (const i of items.rows) {
    const list = byOrder.get(i.order_id) ?? [];
    list.push({ productId: i.cafe_product_id, quantity: i.quantity, modifierOptionIds: i.modifier_option_ids });
    byOrder.set(i.order_id, list);
  }
  return {
    orders: rows
      .sort((a, b) => a.created_at - b.created_at)
      .map((r) => ({
        publicReference: r.public_reference,
        clientRequestId: r.client_request_id,
        attempt: r.delivery_attempts,
        leaseExpiresAt: leaseUntil.toISOString(),
        createdAt: r.created_at.toISOString(),
        // Shaped like Café's CreateUnifiedOrderDto. expectedTotalCents is the
        // platform's estimate from the last catalog sync: Café recomputes and
        // rejects (PriceTamperedMismatch) if its authoritative total differs.
        order: {
          orderType: r.order_type,
          orderChannel: r.order_channel,
          tableId: r.cafe_table_id,
          tableToken: r.table_token,
          items: byOrder.get(r.id) ?? [],
          customerInfo: {
            fullName: r.customer_name,
            phone: r.customer_phone,
            deliveryAddress: r.delivery_address,
            customerNotes: r.customer_notes
          },
          paymentMethod: r.payment_method,
          expectedTotalCents: r.estimated_total_cents,
          clientRequestId: r.client_request_id
        }
      }))
  };
}

const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
const PAYMENT_STATUSES = ['PENDING', 'SUBMITTED', 'VERIFICATION_REQUIRED', 'VERIFIED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;
const cents = z.number().int().min(0).max(1_000_000_000);

export const orderResultSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('CREATED'),
    orderNumber: z.string().trim().min(1).max(40),
    orderStatus: z.enum(ORDER_STATUSES),
    paymentStatus: z.enum(PAYMENT_STATUSES),
    subtotalCents: cents,
    discountCents: cents,
    totalCents: cents,
    statusVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0)
  }),
  z.object({
    outcome: z.literal('REJECTED'),
    errorCode: z.string().trim().min(1).max(64).regex(/^[A-Za-z_]+$/),
    customerMessage: z.string().trim().max(200).nullable().optional()
  })
]);

/** Café error code (Rust variant or snake case) → stable platform code. */
export function normalizeCafeErrorCode(raw: string): string {
  const key = raw.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const map: Record<string, string> = {
    PRICETAMPEREDMISMATCH: 'PRICE_TAMPERED_MISMATCH',
    INSUFFICIENTSTOCK: 'INSUFFICIENT_STOCK',
    INSUFFICIENTRAWMATERIALSTOCK: 'INSUFFICIENT_STOCK',
    INVALIDMODIFIEROPTION: 'INVALID_MODIFIER_OPTION',
    PRODUCTINACTIVE: 'PRODUCT_INACTIVE',
    PRODUCTNOTAVAILABLEONLINE: 'PRODUCT_UNAVAILABLE',
    CUSTOMERDATAREQUIRED: 'CUSTOMER_DATA_REQUIRED',
    INVALIDTABLETOKEN: 'INVALID_TABLE_TOKEN',
    TABLEINACTIVEORINVALID: 'INVALID_TABLE_TOKEN',
    IDEMPOTENCYKEYCONFLICT: 'IDEMPOTENCY_KEY_CONFLICT',
    VALIDATIONERROR: 'VALIDATION_FAILED'
  };
  return map[key] ?? 'CAFE_REJECTED';
}

async function lockOrder(client: Queryable, p: ConnectorPrincipal, publicReference: string) {
  if (!PUBLIC_REFERENCE_PATTERN.test(publicReference)) throw notFound('ORDER_NOT_FOUND');
  // tenant_id comes from the credential: a connector can't see or touch another café's orders.
  const { rows } = await client.query('SELECT * FROM orders WHERE tenant_id = $1 AND public_reference = $2 FOR UPDATE', [p.tenantUuid, publicReference]);
  if (!rows[0]) throw notFound('ORDER_NOT_FOUND');
  return rows[0];
}

export async function reportOrderResult(ctx: AppContext, p: ConnectorPrincipal, publicReference: string, result: z.infer<typeof orderResultSchema>) {
  const now = ctx.now();
  return withTx(ctx.db, async (client) => {
    const order = await lockOrder(client, p, publicReference);

    // Repeated reports (connector retry after a lost response) are idempotent.
    if (order.delivery_state === 'DELIVERED') {
      if (result.outcome === 'CREATED' && result.orderNumber === order.cafe_order_number) return { applied: false };
      throw new ApiError(409, 'RESULT_CONFLICT');
    }
    if (order.delivery_state === 'REJECTED_BY_CAFE') {
      if (result.outcome === 'REJECTED') return { applied: false };
      throw new ApiError(409, 'RESULT_CONFLICT');
    }
    // Only an order that was handed to the café can have a café result.
    if (order.delivery_state !== 'LEASED') throw new ApiError(409, 'RESULT_CONFLICT');

    let updated;
    if (result.outcome === 'CREATED') {
      updated = await client.query(
        `UPDATE orders SET delivery_state = 'DELIVERED', delivered_at = $2, lease_expires_at = NULL, cafe_order_number = $3,
                order_status = $4, payment_status = $5, cafe_subtotal_cents = $6, cafe_discount_cents = $7, cafe_total_cents = $8,
                cafe_status_version = $9, updated_at = $2
          WHERE id = $1 RETURNING *`,
        [order.id, now, result.orderNumber, result.orderStatus, result.paymentStatus, result.subtotalCents, result.discountCents, result.totalCents, result.statusVersion]
      );
    } else {
      updated = await client.query(
        `UPDATE orders SET delivery_state = 'REJECTED_BY_CAFE', delivered_at = $2, lease_expires_at = NULL, order_status = 'REJECTED',
                rejection_code = $3, rejection_reason = $4, updated_at = $2
          WHERE id = $1 RETURNING *`,
        [order.id, now, normalizeCafeErrorCode(result.errorCode), result.customerMessage || null]
      );
    }
    await recordHistory(client, updated.rows[0], 'CAFE', result.outcome === 'CREATED' ? 'created in café' : `rejected by café: ${normalizeCafeErrorCode(result.errorCode)}`);
    if (result.outcome === 'REJECTED') {
      await logIntegrationEvent(client, p.tenantUuid, p.connectionId, 'WARN', 'order.rejected_by_cafe', { publicReference, code: normalizeCafeErrorCode(result.errorCode) });
    }
    return { applied: true };
  });
}

export const statusUpdateSchema = z.object({
  orderStatus: z.enum(ORDER_STATUSES),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  statusVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  rejectionReason: z.string().trim().max(200).nullable().optional()
});

const PROGRESS: Record<string, number> = { PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, COMPLETED: 4 };
const TERMINAL = new Set(['COMPLETED', 'REJECTED', 'CANCELLED']);

/**
 * Café owns status; this only refuses impossible reports (moving backwards,
 * leaving a final state). Café may skip steps (e.g. updates made while the
 * connector was offline arrive as one jump), which is allowed.
 */
export function isAllowedTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (TERMINAL.has(from)) return false;
  if (to === 'REJECTED') return from === 'PENDING';
  if (to === 'CANCELLED') return true;
  return PROGRESS[to] > PROGRESS[from];
}

export async function reportStatus(ctx: AppContext, p: ConnectorPrincipal, publicReference: string, update: z.infer<typeof statusUpdateSchema>) {
  const now = ctx.now();
  return withTx(ctx.db, async (client) => {
    const order = await lockOrder(client, p, publicReference);
    if (order.delivery_state !== 'DELIVERED') throw new ApiError(409, 'INVALID_TRANSITION');
    // Inbox idempotency: duplicates and out-of-order (older) reports are ignored.
    if (update.statusVersion <= order.cafe_status_version) return { applied: false };
    if (!isAllowedTransition(order.order_status, update.orderStatus)) throw new ApiError(409, 'INVALID_TRANSITION');
    const { rows } = await client.query(
      `UPDATE orders SET order_status = $2, payment_status = $3, cafe_status_version = $4,
              rejection_reason = CASE WHEN $2 IN ('REJECTED', 'CANCELLED') THEN $5 ELSE rejection_reason END, updated_at = $6
        WHERE id = $1 RETURNING *`,
      [order.id, update.orderStatus, update.paymentStatus, update.statusVersion, update.rejectionReason || null, now]
    );
    await recordHistory(client, rows[0], 'CAFE', null);
    return { applied: true };
  });
}

export type { Db };
