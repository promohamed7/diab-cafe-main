// Order intake: validation, price authority, idempotency, connectivity policy,
// expiry, and the safe customer-facing projection.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AdminSession, CafeSetup, Harness } from './helpers.ts';
import { SUPER_EMAIL, TABLES_A, catalogA, createHarness, login, onboardCafe, pickupOrder, publicCall, requestId } from './helpers.ts';

const ORDERS = '/api/public/v1/tenants/cafe-a/orders';

let h: Harness;
let admin: AdminSession;
let cafe: CafeSetup;

before(async () => {
  h = await createHarness();
  admin = await login(h.app, SUPER_EMAIL);
  cafe = await onboardCafe(h, admin, 'cafe-a', catalogA(), TABLES_A);
});
after(async () => h.close());

async function orderCount(): Promise<number> {
  const { rows } = await h.db.query('SELECT count(*)::int AS n FROM orders');
  return rows[0].n;
}

describe('price authority', () => {
  test('server computes the estimate; client price fields are ignored', async () => {
    const res = await publicCall(h.app, 'POST', ORDERS, {
      ...pickupOrder({ expectedTotalCents: undefined }),
      items: [{ productId: 101, quantity: 1, modifierOptionIds: [1101], unitPriceCents: 1, priceCents: 1 }],
      totalCents: 1,
      discountCents: 99999,
      orderStatus: 'COMPLETED',
      paymentStatus: 'PAID',
      orderNumber: 'ORD-1'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.estimatedTotalCents, 5000);
    assert.equal(res.body.orderStatus, 'PENDING');
    assert.equal(res.body.paymentStatus, 'PENDING');
    assert.equal(res.body.orderNumber, null, 'only Café assigns order numbers');
    assert.equal(res.body.totalCents, null, 'authoritative total comes from Café only');
  });

  test('a tampered expected total is rejected', async () => {
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder({ expectedTotalCents: 100 }));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'PRICE_TAMPERED_MISMATCH');
  });

  test('a matching expected total is accepted', async () => {
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder());
    assert.equal(res.status, 201);
    assert.equal(res.body.estimatedTotalCents, 13000);
    assert.match(res.body.publicReference, /^INB-[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
  });
});

describe('idempotency', () => {
  test('same key + same payload replays the original acknowledgement', async () => {
    const body = pickupOrder();
    const first = await publicCall(h.app, 'POST', ORDERS, body);
    const before = await orderCount();
    const second = await publicCall(h.app, 'POST', ORDERS, body, { 'idempotency-key': body.clientRequestId as string });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.replayed, true);
    assert.equal(second.body.publicReference, first.body.publicReference);
    assert.equal(await orderCount(), before);
  });

  test('same key + different payload is a deterministic conflict', async () => {
    const body = pickupOrder();
    await publicCall(h.app, 'POST', ORDERS, body);
    const changed = await publicCall(h.app, 'POST', ORDERS, { ...body, items: [{ productId: 102, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: 2500 });
    assert.equal(changed.status, 409);
    assert.equal(changed.body.error.code, 'IDEMPOTENCY_KEY_CONFLICT');
  });

  test('concurrent submissions with one key create exactly one order', async () => {
    const body = pickupOrder();
    const before = await orderCount();
    const results = await Promise.all(Array.from({ length: 8 }, () => publicCall(h.app, 'POST', ORDERS, body)));
    assert.deepEqual(new Set(results.map((r) => r.body.publicReference)).size, 1);
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(await orderCount(), before + 1);
  });

  test('replay is honoured even after the café went offline', async () => {
    const body = pickupOrder();
    await publicCall(h.app, 'POST', ORDERS, body);
    h.clock.advance(10 * 60_000);
    const replay = await publicCall(h.app, 'POST', ORDERS, body);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    await cafe.connector.heartbeat();
  });

  test('Idempotency-Key header must match the body', async () => {
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder(), { 'idempotency-key': requestId() });
    assert.equal(res.status, 400);
  });
});

describe('catalog and journey validation', () => {
  const cases: [string, Record<string, unknown>, number, string][] = [
    ['product not sold online', { items: [{ productId: 103, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined }, 422, 'PRODUCT_INACTIVE'],
    ['unknown product', { items: [{ productId: 999, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined }, 422, 'PRODUCT_INACTIVE'],
    ['product unavailable', { items: [{ productId: 104, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined }, 422, 'PRODUCT_UNAVAILABLE'],
    ['required modifier missing', { items: [{ productId: 101, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined }, 422, 'INVALID_MODIFIER_OPTION'],
    ['two options in a single-choice group', { items: [{ productId: 101, quantity: 1, modifierOptionIds: [1101, 1102] }], expectedTotalCents: undefined }, 422, 'INVALID_MODIFIER_OPTION'],
    ['option of another product', { items: [{ productId: 102, quantity: 1, modifierOptionIds: [1101] }], expectedTotalCents: undefined }, 422, 'INVALID_MODIFIER_OPTION'],
    ['duplicate option', { items: [{ productId: 101, quantity: 1, modifierOptionIds: [1101, 1201, 1201] }], expectedTotalCents: undefined }, 422, 'INVALID_MODIFIER_OPTION'],
    ['quantity too high', { items: [{ productId: 102, quantity: 21, modifierOptionIds: [] }], expectedTotalCents: undefined }, 400, 'VALIDATION_FAILED'],
    ['pickup without phone', { customerInfo: { fullName: 'Mona' } }, 422, 'CUSTOMER_DATA_REQUIRED'],
    ['delivery without address', { orderType: 'DELIVERY' }, 422, 'CUSTOMER_DATA_REQUIRED'],
    ['transfer methods are not offered', { paymentMethod: 'INSTAPAY' }, 422, 'PAYMENT_METHOD_UNAVAILABLE'],
    ['dine-in on the online channel', { orderType: 'DINE_IN' }, 400, 'VALIDATION_FAILED'],
    ['dine-in without a table token', { orderType: 'DINE_IN', orderChannel: 'TABLE_QR' }, 422, 'INVALID_TABLE_TOKEN'],
    ['dine-in with an invented token', { orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: 'table_7_guess' }, 422, 'INVALID_TABLE_TOKEN'],
    ['table token on a pickup order', { tableToken: 'tblA_window_0001' }, 400, 'VALIDATION_FAILED']
  ];
  for (const [name, overrides, status, code] of cases) {
    test(name, async () => {
      const before = await orderCount();
      const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder(overrides));
      assert.equal(res.status, status, JSON.stringify(res.body));
      assert.equal(res.body.error.code, code);
      assert.equal(await orderCount(), before, 'nothing is stored for a rejected request');
    });
  }

  test('dine-in with the café-issued token is accepted and keeps the table', async () => {
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: 'tblA_window_0001', customerInfo: {} }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { rows } = await h.db.query('SELECT cafe_table_id, table_label FROM orders WHERE public_reference = $1', [res.body.publicReference]);
    assert.deepEqual(rows[0], { cafe_table_id: 1, table_label: 'A1 — Window' });
  });

  test('a disabled journey is refused', async () => {
    const off = await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/sections/ordering', {
      onlineOrdering: true, pickup: true, delivery: false, dineInQr: true, paymentMethods: ['CASH'],
      minimumOrderCents: 10000, deliveryAreaText: null, offlineOrderPolicy: 'REJECT', queueTtlMinutes: 15
    });
    assert.equal(off.status, 200);
    const delivery = await publicCall(h.app, 'POST', ORDERS, pickupOrder({ orderType: 'DELIVERY', customerInfo: { fullName: 'Mona', phone: '01001234567', deliveryAddress: '12 Nile Street, Cairo' } }));
    assert.equal(delivery.body.error.code, 'ORDER_TYPE_DISABLED');
    const card = await publicCall(h.app, 'POST', ORDERS, pickupOrder({ paymentMethod: 'CREDIT_CARD' }));
    assert.equal(card.body.error.code, 'PAYMENT_METHOD_UNAVAILABLE');
    const small = await publicCall(h.app, 'POST', ORDERS, pickupOrder({ items: [{ productId: 102, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: 2500 }));
    assert.equal(small.status, 400);
    assert.deepEqual(small.body.error.fields, ['minimumOrder']);
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/sections/ordering', {
      onlineOrdering: true, pickup: true, delivery: true, dineInQr: true, paymentMethods: ['CASH', 'CREDIT_CARD'],
      minimumOrderCents: null, deliveryAreaText: null, offlineOrderPolicy: 'REJECT', queueTtlMinutes: 15
    });
  });
});

describe('café connectivity (offline-first POS)', () => {
  test('REJECT policy: an offline café receives no orders and nothing is stored', async () => {
    h.clock.advance(5 * 60_000);
    const before = await orderCount();
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder());
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'STORE_OFFLINE');
    assert.equal(await orderCount(), before);
    await cafe.connector.heartbeat();
  });

  test('QUEUE policy: accepted honestly as awaiting the café, expires as NOT_DELIVERED', async () => {
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/sections/ordering', {
      onlineOrdering: true, pickup: true, delivery: true, dineInQr: true, paymentMethods: ['CASH', 'CREDIT_CARD'],
      minimumOrderCents: null, deliveryAreaText: null, offlineOrderPolicy: 'QUEUE', queueTtlMinutes: 10
    });
    // Drain everything queued so far so this test controls the queue.
    await cafe.connector.processOrders(50);
    h.clock.advance(5 * 60_000);
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder());
    assert.equal(res.status, 201);
    assert.equal(res.body.deliveryState, 'AWAITING_CAFE');

    h.clock.advance(11 * 60_000);
    const track = await publicCall(h.app, 'GET', `${ORDERS}/${res.body.publicReference}`);
    assert.equal(track.body.deliveryState, 'NOT_DELIVERED');
    assert.equal(track.body.orderStatus, 'CANCELLED');

    // The café comes back: the expired order is never handed out.
    await cafe.connector.heartbeat();
    const processed = await cafe.connector.processOrders();
    assert.equal(processed.find((p) => p.publicReference === res.body.publicReference), undefined);
  });

  test('a leased order is never expired by the platform (the café may have created it)', async () => {
    const res = await publicCall(h.app, 'POST', ORDERS, pickupOrder());
    assert.equal(res.status, 201);
    // Lease without reporting (connector crashed mid-delivery).
    const lease = await h.app.inject({ method: 'POST', url: '/api/integration/v1/orders/lease', headers: { authorization: `Bearer ${cafe.credential}` }, payload: { max: 50 } });
    assert.ok(lease.json().orders.some((o: any) => o.publicReference === res.body.publicReference));
    h.clock.advance(60 * 60_000);
    const track = await publicCall(h.app, 'GET', `${ORDERS}/${res.body.publicReference}`);
    assert.equal(track.body.deliveryState, 'AWAITING_CAFE');
    await cafe.connector.heartbeat();
    const again = await cafe.connector.processOrders(50);
    const mine = again.find((p) => p.publicReference === res.body.publicReference);
    assert.equal(mine?.result.outcome, 'CREATED', JSON.stringify(mine));
  });

  test('a café that never connected cannot take orders', async () => {
    await admin.request('POST', '/api/admin/v1/tenants', { tenantId: 'cafe-unpaired', displayName: 'Unpaired', currencyCode: 'EGP', currencySymbol: 'ج.م' });
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-unpaired/sections/ordering', {
      onlineOrdering: true, pickup: true, delivery: false, dineInQr: false, paymentMethods: ['CASH'],
      minimumOrderCents: null, deliveryAreaText: null, offlineOrderPolicy: 'QUEUE', queueTtlMinutes: 10
    });
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-unpaired/status', { status: 'ACTIVE' });
    const res = await publicCall(h.app, 'POST', '/api/public/v1/tenants/cafe-unpaired/orders', pickupOrder());
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'MENU_NOT_SYNCED');
  });
});

describe('customer-facing projection', () => {
  test('acknowledgement and tracking expose only allow-listed fields', async () => {
    const ack = await publicCall(h.app, 'POST', ORDERS, pickupOrder());
    assert.deepEqual(Object.keys(ack.body).sort(), [
      'createdAt', 'deliveryState', 'discountCents', 'estimatedTotalCents', 'orderNumber', 'orderStatus',
      'paymentStatus', 'publicReference', 'replayed', 'subtotalCents', 'tenantId', 'totalCents'
    ]);
    const track = await publicCall(h.app, 'GET', `${ORDERS}/${ack.body.publicReference}`);
    assert.deepEqual(Object.keys(track.body).sort(), [
      'deliveryState', 'estimatedTotalCents', 'orderNumber', 'orderStatus', 'orderType', 'paymentStatus',
      'publicReference', 'rejectionReason', 'tenantId', 'totalCents', 'updatedAt'
    ]);
    const text = JSON.stringify(track.body);
    for (const leak of ['Mona', '0100123', 'client', 'cafe_', 'tenant_id', 'uuid']) assert.ok(!text.includes(leak), leak);
  });

  test('references are not enumerable: malformed and unknown references are both 404', async () => {
    for (const ref of ['1', 'ORD-1001', 'INB-0000-0000-0000-0000', "INB-' OR 1=1 --"]) {
      const res = await publicCall(h.app, 'GET', `${ORDERS}/${encodeURIComponent(ref)}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
    }
  });

  test('customer contact data is erased after the retention period', async () => {
    const { redactExpiredCustomerData } = await import('../src/modules/orders/orderService.ts');
    await h.db.query(`UPDATE orders SET order_status = 'COMPLETED'`);
    const n = await redactExpiredCustomerData(h.db, new Date(h.clock.now.getTime() + 31 * 86_400_000), 30);
    assert.ok(n > 0);
    const { rows } = await h.db.query('SELECT count(*)::int AS n FROM orders WHERE customer_phone IS NOT NULL');
    assert.equal(rows[0].n, 0);
  });
});
