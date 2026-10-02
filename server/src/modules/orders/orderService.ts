// Customer order intake, delivery to the café's POS, and the customer-facing
// tracking projection.
//
// Responsibilities (see docs/ORDER_FLOW.md):
//   platform   — validate structure, tenant, journey, table capability, catalog
//                references and customer data; enforce idempotency; queue the
//                intent for the café; expose a safe tracking view.
//   INBYTE Café — re-price, check stock/modifiers, create the authoritative
//                order (ORD-…), own status and payment.
// The browser never supplies a price, order number, status, cashier or shift:
// those fields don't exist in the request schema and are dropped if sent.

import { z } from 'zod';
import { buildCatalogIndex } from '../../../../src/domain/catalogIndex.ts';
import { canonicalJson } from '../../../../src/domain/checkoutAttempt.ts';
import { validateCheckoutInput } from '../../../../src/domain/customer.ts';
import { normalizeOptionIds, validateModifierSelection } from '../../../../src/domain/modifiers.ts';
import { estimateLineCents } from '../../../../src/domain/pricing.ts';
import type { AppContext } from '../../http/context.ts';
import type { Db, DbClient, Queryable } from '../../db/pool.ts';
import { isUniqueViolation, withTx } from '../../db/pool.ts';
import { ApiError, badRequest, notFound } from '../../http/errors.ts';
import { PUBLIC_REFERENCE_PATTERN, newPublicReference, sha256 } from '../../security/tokens.ts';
import { loadProjection, toPublicCatalog } from '../catalog/catalogService.ts';
import { resolveTableToken } from '../tables/tableService.ts';
import type { TenantRecord } from '../tenants/tenantService.ts';
import { connectionHealth } from '../tenants/tenantService.ts';

const cafeId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const submitOrderSchema = z.object({
  orderType: z.enum(['PICKUP', 'DELIVERY', 'DINE_IN']),
  orderChannel: z.enum(['ONLINE', 'TABLE_QR']),
  items: z
    .array(
      z.object({
        productId: cafeId,
        quantity: z.number().int().min(1).max(20),
        modifierOptionIds: z.array(cafeId).max(20).default([])
      })
    )
    .min(1)
    .max(25),
  customerInfo: z
    .object({
      fullName: z.string().max(200).optional(),
      phone: z.string().max(40).optional(),
      deliveryAddress: z.string().max(1000).optional(),
      customerNotes: z.string().max(1000).optional()
    })
    .default({}),
  tableToken: z.string().max(200).optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'INSTAPAY', 'WALLET', 'ONLINE_PAID']),
  paymentReference: z.string().max(100).optional(),
  expectedTotalCents: z.number().int().min(0).max(1_000_000_000).optional(),
  clientRequestId: z.uuid()
});

export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

/** Methods the website can take today (settled with staff at handover). */
const SUPPORTED_PAYMENT_METHODS = new Set(['CASH', 'CREDIT_CARD']);

export type PublicDeliveryState = 'AWAITING_CAFE' | 'RECEIVED_BY_CAFE' | 'NOT_DELIVERED';

export interface OrderAcknowledgementDto {
  tenantId: string;
  publicReference: string;
  orderNumber: string | null;
  orderStatus: string;
  paymentStatus: string;
  deliveryState: PublicDeliveryState;
  estimatedTotalCents: number;
  subtotalCents: number | null;
  discountCents: number | null;
  totalCents: number | null;
  createdAt: string;
  replayed: boolean;
}

export interface OrderStatusDto {
  tenantId: string;
  publicReference: string;
  orderNumber: string | null;
  orderType: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryState: PublicDeliveryState;
  estimatedTotalCents: number;
  totalCents: number | null;
  rejectionReason: string | null;
  updatedAt: string;
}

export function publicDeliveryState(state: string): PublicDeliveryState {
  if (state === 'DELIVERED' || state === 'REJECTED_BY_CAFE') return 'RECEIVED_BY_CAFE';
  if (state === 'NOT_DELIVERED') return 'NOT_DELIVERED';
  return 'AWAITING_CAFE';
}

function toAck(tenantKey: string, r: Record<string, any>, replayed: boolean): OrderAcknowledgementDto {
  return {
    tenantId: tenantKey,
    publicReference: r.public_reference,
    orderNumber: r.cafe_order_number,
    orderStatus: r.order_status,
    paymentStatus: r.payment_status,
    deliveryState: publicDeliveryState(r.delivery_state),
    estimatedTotalCents: r.estimated_total_cents,
    subtotalCents: r.cafe_subtotal_cents,
    discountCents: r.cafe_discount_cents,
    totalCents: r.cafe_total_cents,
    createdAt: r.created_at.toISOString(),
    replayed
  };
}

/** Stable fingerprint of everything that defines the order (not the idempotency key itself). */
export function fingerprintRequest(input: SubmitOrderInput): string {
  const { clientRequestId: _ignored, paymentReference: _ref, ...rest } = input;
  return sha256(
    canonicalJson({
      ...rest,
      items: rest.items.map((i) => ({ ...i, modifierOptionIds: normalizeOptionIds(i.modifierOptionIds) }))
    })
  );
}

async function findByRequestId(db: Queryable, tenantUuid: string, clientRequestId: string) {
  const { rows } = await db.query('SELECT * FROM orders WHERE tenant_id = $1 AND client_request_id = $2', [tenantUuid, clientRequestId]);
  return rows[0] ?? null;
}

function replayOrConflict(tenant: TenantRecord, row: Record<string, any>, fingerprint: string): OrderAcknowledgementDto {
  if (row.request_fingerprint !== fingerprint) throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT');
  return toAck(tenant.tenantId, row, true);
}

export interface SubmitResult {
  ack: OrderAcknowledgementDto;
  created: boolean;
}

export async function submitOrder(ctx: AppContext, tenant: TenantRecord, input: SubmitOrderInput): Promise<SubmitResult> {
  const now = ctx.now();
  const fingerprint = fingerprintRequest(input);

  // 1. Idempotency first: a retry must get the original answer even if the café
  //    went offline or the menu changed since.
  const existing = await findByRequestId(ctx.db, tenant.uuid, input.clientRequestId);
  if (existing) return { ack: replayOrConflict(tenant, existing, fingerprint), created: false };

  // 2. Journey and configuration.
  if (!tenant.features.onlineOrdering) throw new ApiError(422, 'ORDERING_DISABLED');
  const isDineIn = input.orderType === 'DINE_IN';
  if (isDineIn !== (input.orderChannel === 'TABLE_QR')) throw badRequest('VALIDATION_FAILED', ['orderChannel']);
  const typeEnabled =
    (input.orderType === 'PICKUP' && tenant.features.pickup) ||
    (input.orderType === 'DELIVERY' && tenant.features.delivery) ||
    (isDineIn && tenant.features.dineInQr);
  if (!typeEnabled) throw new ApiError(422, 'ORDER_TYPE_DISABLED');
  if (!SUPPORTED_PAYMENT_METHODS.has(input.paymentMethod) || !tenant.paymentMethods.includes(input.paymentMethod)) {
    throw new ApiError(422, 'PAYMENT_METHOD_UNAVAILABLE');
  }

  // 3. Customer data (same rules as the website, enforced server-side).
  const c = input.customerInfo;
  const customer = validateCheckoutInput(
    {
      fullName: c.fullName ?? '',
      phone: c.phone ?? '',
      deliveryAddress: c.deliveryAddress ?? '',
      notes: c.customerNotes ?? '',
      paymentMethod: input.paymentMethod as 'CASH' | 'CREDIT_CARD'
    },
    input.orderType
  );
  const fieldErrors = Object.keys(customer.errors);
  if (fieldErrors.length) {
    const missing = fieldErrors.some((f) => {
      const v = f === 'fullName' ? c.fullName : f === 'phone' ? c.phone : f === 'deliveryAddress' ? c.deliveryAddress : 'x';
      return !v || !v.trim();
    });
    throw new ApiError(422, missing ? 'CUSTOMER_DATA_REQUIRED' : 'VALIDATION_FAILED', fieldErrors);
  }

  // 4. Table capability (dine-in only), always within this café.
  let table: { tableId: number; label: string; token: string } | null = null;
  if (isDineIn) {
    table = input.tableToken ? await resolveTableToken(ctx.db, tenant.uuid, input.tableToken) : null;
    if (!table) throw new ApiError(422, 'INVALID_TABLE_TOKEN');
  } else if (input.tableToken) {
    throw badRequest('VALIDATION_FAILED', ['tableToken']);
  }

  // 5. Catalog references against the café's last synced projection.
  const projection = await loadProjection(ctx.db, tenant.uuid);
  if (!projection.syncedAt) throw new ApiError(503, 'MENU_NOT_SYNCED');
  const index = buildCatalogIndex(toPublicCatalog(tenant, projection));
  let estimate = 0;
  const lines = input.items.map((item, i) => {
    const product = index.productsById.get(item.productId);
    if (!product) throw new ApiError(422, 'PRODUCT_INACTIVE', [`items.${i}.productId`]);
    if (product.availability === 'UNAVAILABLE') throw new ApiError(422, 'PRODUCT_UNAVAILABLE', [`items.${i}.productId`]);
    const optionIds = normalizeOptionIds(item.modifierOptionIds);
    if (optionIds.length !== item.modifierOptionIds.length || validateModifierSelection(product, optionIds).length) {
      throw new ApiError(422, 'INVALID_MODIFIER_OPTION', [`items.${i}.modifierOptionIds`]);
    }
    const lineCents = estimateLineCents(product, optionIds, item.quantity);
    estimate += lineCents;
    return { productId: product.id, name: product.name, quantity: item.quantity, optionIds, lineCents };
  });
  if (tenant.minimumOrderCents && estimate < tenant.minimumOrderCents) throw badRequest('VALIDATION_FAILED', ['minimumOrder']);
  if (input.expectedTotalCents !== undefined && input.expectedTotalCents !== estimate) {
    throw new ApiError(409, 'PRICE_TAMPERED_MISMATCH');
  }

  // 6. Is the café's POS reachable? Never pretend an order reached a café that can't receive it.
  const conn = await ctx.db.query(
    `SELECT status, last_seen_at FROM integration_connections WHERE tenant_id = $1 AND status <> 'REVOKED'`,
    [tenant.uuid]
  );
  const health = connectionHealth(conn.rows[0]?.status ?? null, conn.rows[0]?.last_seen_at ?? null, ctx.config.connectorOfflineAfterSeconds, now);
  if (health === 'NOT_CONNECTED' || health === 'PENDING_PAIRING') throw new ApiError(503, 'SERVICE_UNAVAILABLE');
  if (health === 'OFFLINE' && tenant.offlineOrderPolicy === 'REJECT') throw new ApiError(503, 'STORE_OFFLINE');
  const deliverBefore = new Date(now.getTime() + tenant.queueTtlMinutes * 60_000);

  // 7. Persist atomically. A concurrent request with the same key loses the
  //    unique-index race and gets the winner's answer (or a conflict).
  const values = customer.values;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await withTx(ctx.db, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO orders (tenant_id, public_reference, client_request_id, request_fingerprint, order_type, order_channel,
             cafe_table_id, table_token, table_label, customer_name, customer_phone, delivery_address, customer_notes,
             payment_method, expected_total_cents, estimated_total_cents, deliver_before, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18) RETURNING *`,
          [
            tenant.uuid,
            newPublicReference(),
            input.clientRequestId,
            fingerprint,
            input.orderType,
            input.orderChannel,
            table?.tableId ?? null,
            table?.token ?? null,
            table?.label ?? null,
            values.fullName || null,
            values.phone || null,
            input.orderType === 'DELIVERY' ? values.deliveryAddress : null,
            values.notes || null,
            input.paymentMethod,
            input.expectedTotalCents ?? null,
            estimate,
            deliverBefore,
            now
          ]
        );
        const order = rows[0];
        await client.query(
          `INSERT INTO order_items (order_id, line_no, cafe_product_id, quantity, modifier_option_ids, product_name, estimated_line_cents)
           SELECT $1, x.line, x.pid, x.qty, x.mods::bigint[], x.name, x.cents
             FROM unnest($2::smallint[], $3::bigint[], $4::int[], $5::text[], $6::text[], $7::bigint[]) AS x(line, pid, qty, mods, name, cents)`,
          [
            order.id,
            lines.map((_, i) => i + 1),
            lines.map((l) => l.productId),
            lines.map((l) => l.quantity),
            lines.map((l) => `{${l.optionIds.join(',')}}`),
            lines.map((l) => l.name),
            lines.map((l) => l.lineCents)
          ]
        );
        await recordHistory(client, order, 'PLATFORM', health === 'OFFLINE' ? 'queued while café offline' : 'queued');
        return order;
      });
      return { ack: toAck(tenant.tenantId, row, false), created: true };
    } catch (error) {
      if (isUniqueViolation(error, 'orders_tenant_id_client_request_id_key')) {
        const winner = await findByRequestId(ctx.db, tenant.uuid, input.clientRequestId);
        if (winner) return { ack: replayOrConflict(tenant, winner, fingerprint), created: false };
      }
      if (!isUniqueViolation(error, 'orders_public_reference_key')) throw error;
      // 80-bit reference collision: astronomically unlikely, just draw again.
    }
  }
  throw new ApiError(503, 'SERVICE_UNAVAILABLE');
}

export async function recordHistory(client: Queryable, order: Record<string, any>, source: 'PLATFORM' | 'CAFE' | 'SYSTEM', note: string | null) {
  await client.query(
    `INSERT INTO order_status_history (order_id, source, order_status, payment_status, delivery_state, note) VALUES ($1, $2, $3, $4, $5, $6)`,
    [order.id, source, order.order_status, order.payment_status, order.delivery_state, note]
  );
}

// ---- Tracking ------------------------------------------------------------------

/**
 * Customer tracking by public reference, within one café. Exposes only the
 * customer-facing projection: no internal IDs, cashier, shift, cost or other
 * customers' data.
 */
export async function getOrderStatus(ctx: AppContext, tenant: TenantRecord, publicReference: string): Promise<OrderStatusDto> {
  if (!PUBLIC_REFERENCE_PATTERN.test(publicReference)) throw notFound('ORDER_NOT_FOUND');
  await expireUndeliveredOrders(ctx.db, ctx.now(), { tenantUuid: tenant.uuid, publicReference });
  const { rows } = await ctx.db.query('SELECT * FROM orders WHERE tenant_id = $1 AND public_reference = $2', [tenant.uuid, publicReference]);
  const r = rows[0];
  if (!r) throw notFound('ORDER_NOT_FOUND');
  return {
    tenantId: tenant.tenantId,
    publicReference: r.public_reference,
    orderNumber: r.cafe_order_number,
    orderType: r.order_type,
    orderStatus: r.order_status,
    paymentStatus: r.payment_status,
    deliveryState: publicDeliveryState(r.delivery_state),
    estimatedTotalCents: r.estimated_total_cents,
    totalCents: r.cafe_total_cents,
    rejectionReason: r.rejection_reason,
    updatedAt: r.updated_at.toISOString()
  };
}

/**
 * Orders the café never picked up before their deadline are closed honestly as
 * NOT_DELIVERED. Orders a connector already leased are never expired: the café
 * may have created them, so only the connector's report may settle them.
 */
export async function expireUndeliveredOrders(
  db: Db,
  now: Date,
  scope: { tenantUuid?: string; publicReference?: string } = {}
): Promise<number> {
  return withTx(db, async (client) => {
    const { rows } = await client.query(
      `UPDATE orders SET delivery_state = 'NOT_DELIVERED', order_status = 'CANCELLED', updated_at = $1
        WHERE delivery_state = 'QUEUED' AND delivery_attempts = 0 AND deliver_before <= $1
          AND ($2::uuid IS NULL OR tenant_id = $2) AND ($3::text IS NULL OR public_reference = $3)
        RETURNING *`,
      [now, scope.tenantUuid ?? null, scope.publicReference ?? null]
    );
    for (const r of rows) await recordHistory(client, r, 'SYSTEM', 'not picked up by the café in time');
    return rows.length;
  });
}

/** Erases customer contact data on settled orders after the retention period. */
export async function redactExpiredCustomerData(db: Queryable, now: Date, retentionDays: number): Promise<number> {
  const res = await db.query(
    `UPDATE orders SET customer_name = NULL, customer_phone = NULL, delivery_address = NULL, customer_notes = NULL,
            customer_data_redacted_at = $1
      WHERE customer_data_redacted_at IS NULL AND created_at < $1::timestamptz - make_interval(days => $2)
        AND (order_status IN ('COMPLETED', 'REJECTED', 'CANCELLED') OR delivery_state IN ('NOT_DELIVERED', 'REJECTED_BY_CAFE'))`,
    [now, retentionDays]
  );
  return res.rowCount ?? 0;
}

// ---- Admin views ------------------------------------------------------------------

export async function listOrdersForAdmin(db: Queryable, tenantUuid: string, filter: { deliveryState?: string; limit: number; before?: string }) {
  const params: unknown[] = [tenantUuid];
  let where = 'tenant_id = $1';
  if (filter.deliveryState) {
    params.push(filter.deliveryState);
    where += ` AND delivery_state = $${params.length}`;
  }
  if (filter.before) {
    params.push(new Date(filter.before));
    where += ` AND created_at < $${params.length}`;
  }
  params.push(filter.limit);
  const { rows } = await db.query(
    `SELECT public_reference, order_type, order_channel, table_label, payment_method, estimated_total_cents, cafe_total_cents,
            cafe_order_number, order_status, payment_status, delivery_state, delivery_attempts, created_at, updated_at, delivered_at
       FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows.map((r) => ({
    publicReference: r.public_reference,
    orderType: r.order_type,
    orderChannel: r.order_channel,
    tableLabel: r.table_label,
    paymentMethod: r.payment_method,
    estimatedTotalCents: r.estimated_total_cents,
    totalCents: r.cafe_total_cents,
    orderNumber: r.cafe_order_number,
    orderStatus: r.order_status,
    paymentStatus: r.payment_status,
    deliveryState: r.delivery_state,
    deliveryAttempts: r.delivery_attempts,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    deliveredAt: r.delivered_at ? r.delivered_at.toISOString() : null
  }));
}

export async function getOrderForAdmin(db: Queryable, tenantUuid: string, publicReference: string) {
  const { rows } = await db.query('SELECT * FROM orders WHERE tenant_id = $1 AND public_reference = $2', [tenantUuid, publicReference]);
  const r = rows[0];
  if (!r) throw notFound('ORDER_NOT_FOUND');
  const [items, history] = await Promise.all([
    db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY line_no', [r.id]),
    db.query('SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY id', [r.id])
  ]);
  return {
    publicReference: r.public_reference,
    orderType: r.order_type,
    orderChannel: r.order_channel,
    tableLabel: r.table_label,
    customer: r.customer_data_redacted_at
      ? null
      : { fullName: r.customer_name, phone: r.customer_phone, deliveryAddress: r.delivery_address, notes: r.customer_notes },
    paymentMethod: r.payment_method,
    expectedTotalCents: r.expected_total_cents,
    estimatedTotalCents: r.estimated_total_cents,
    cafe: {
      orderNumber: r.cafe_order_number,
      subtotalCents: r.cafe_subtotal_cents,
      discountCents: r.cafe_discount_cents,
      totalCents: r.cafe_total_cents,
      statusVersion: r.cafe_status_version
    },
    orderStatus: r.order_status,
    paymentStatus: r.payment_status,
    deliveryState: r.delivery_state,
    deliveryAttempts: r.delivery_attempts,
    deliverBefore: r.deliver_before.toISOString(),
    rejectionCode: r.rejection_code,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at.toISOString(),
    items: items.rows.map((i) => ({
      productId: i.cafe_product_id,
      productName: i.product_name,
      quantity: i.quantity,
      modifierOptionIds: i.modifier_option_ids,
      estimatedLineCents: i.estimated_line_cents
    })),
    history: history.rows.map((h) => ({
      at: h.created_at.toISOString(),
      source: h.source,
      orderStatus: h.order_status,
      paymentStatus: h.payment_status,
      deliveryState: h.delivery_state,
      note: h.note
    }))
  };
}

export type { DbClient };
