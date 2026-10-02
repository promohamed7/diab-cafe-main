// INBYTE Café integration: pairing, credentials, catalog/table sync,
// order delivery (lease → create in Café → result), redelivery without
// duplicates, status reports and Café-side rejections.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AdminSession, CafeSetup, Harness } from './helpers.ts';
import { SUPER_EMAIL, TABLES_A, catalogA, createHarness, injectFetch, login, onboardCafe, pickupOrder, publicCall } from './helpers.ts';
import { ReferenceConnector } from '../../connector/src/referenceConnector.ts';

const BASE = '/api/public/v1/tenants/cafe-a';

let h: Harness;
let admin: AdminSession;
let cafe: CafeSetup;

before(async () => {
  h = await createHarness();
  admin = await login(h.app, SUPER_EMAIL);
  cafe = await onboardCafe(h, admin, 'cafe-a', catalogA(), TABLES_A);
});
after(async () => h.close());

const connectorCall = (credential: string, method: string, url: string, body?: unknown) =>
  publicCall(h.app, method, `/api/integration/v1${url}`, body ?? {}, { authorization: `Bearer ${credential}` });

describe('pairing and credentials', () => {
  test('a pairing code works once', async () => {
    await admin.request('POST', '/api/admin/v1/tenants', { tenantId: 'cafe-p', displayName: 'P', currencyCode: 'EGP', currencySymbol: 'ج.م' });
    const { body } = await admin.request('POST', '/api/admin/v1/tenants/cafe-p/integration/pairing-code');
    assert.match(body.pairingCode, /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const first = await publicCall(h.app, 'POST', '/api/integration/v1/pair', { pairingCode: body.pairingCode, cafeInstanceId: 'x', connectorVersion: '1' });
    assert.equal(first.status, 200);
    assert.equal(first.body.tenantId, 'cafe-p');
    assert.match(first.body.credential, /^inbc_[A-Za-z0-9_-]{43}$/);
    const second = await publicCall(h.app, 'POST', '/api/integration/v1/pair', { pairingCode: body.pairingCode, cafeInstanceId: 'x', connectorVersion: '1' });
    assert.equal(second.status, 401);
    assert.equal(second.body.error.code, 'INVALID_PAIRING_CODE');
    // Only a hash of the credential is stored.
    const { rows } = await h.db.query('SELECT credential_hash FROM integration_connections WHERE credential_prefix IS NOT NULL');
    assert.ok(rows.every((r) => !String(r.credential_hash).startsWith('inbc_')));
  });

  test('an expired pairing code is refused', async () => {
    const { body } = await admin.request('POST', '/api/admin/v1/tenants/cafe-p/integration/pairing-code');
    h.clock.advance(16 * 60_000);
    const res = await publicCall(h.app, 'POST', '/api/integration/v1/pair', { pairingCode: body.pairingCode, cafeInstanceId: 'x', connectorVersion: '1' });
    assert.equal(res.status, 401);
    await cafe.connector.heartbeat();
  });

  test('requests without or with a bad credential are refused', async () => {
    assert.equal((await publicCall(h.app, 'POST', '/api/integration/v1/heartbeat', {})).status, 401);
    assert.equal((await connectorCall('inbc_' + 'A'.repeat(43), 'POST', '/heartbeat')).status, 401);
    assert.equal((await connectorCall('not-a-credential', 'POST', '/heartbeat')).status, 401);
  });

  test('revoking a connection stops its credential immediately', async () => {
    await admin.request('POST', '/api/admin/v1/tenants', { tenantId: 'cafe-r', displayName: 'R', currencyCode: 'EGP', currencySymbol: 'ج.م' });
    const { body } = await admin.request('POST', '/api/admin/v1/tenants/cafe-r/integration/pairing-code');
    const { credential } = await ReferenceConnector.pair('http://platform.test', body.pairingCode, 'r', injectFetch(h.app));
    assert.equal((await connectorCall(credential, 'POST', '/heartbeat')).status, 200);
    assert.equal((await admin.request('POST', '/api/admin/v1/tenants/cafe-r/integration/revoke')).status, 200);
    const after = await connectorCall(credential, 'POST', '/heartbeat');
    assert.equal(after.status, 401);
    assert.equal(after.body.error.code, 'CONNECTION_REVOKED');
  });
});

describe('catalog projection', () => {
  test('Café is authoritative: snapshot fields outside the contract are never stored or published', async () => {
    const snapshot = cafe.engine.catalogSnapshot() as any;
    snapshot.products[0].costCents = 1234;
    snapshot.products[0].barcode = '622000000';
    snapshot.products[0].stockQuantity = 7;
    const res = await connectorCall(cafe.credential, 'PUT', '/catalog', snapshot);
    assert.equal(res.status, 200);
    const pub = await publicCall(h.app, 'GET', `${BASE}/catalog`);
    const text = JSON.stringify(pub.body);
    for (const leak of ['costCents', '1234', 'barcode', 'stockQuantity']) assert.ok(!text.includes(leak), leak);
    // Only active + online products are public.
    assert.deepEqual(pub.body.products.map((p: any) => p.id).sort(), [101, 102, 104]);
  });

  test('a snapshot with broken references is rejected atomically', async () => {
    const snapshot = cafe.engine.catalogSnapshot();
    snapshot.products[0].categoryId = 999;
    const res = await connectorCall(cafe.credential, 'PUT', '/catalog', snapshot);
    assert.equal(res.status, 400);
    const pub = await publicCall(h.app, 'GET', `${BASE}/catalog`);
    assert.equal(pub.body.products.length, 3, 'previous projection still intact');
  });

  test('admin presentation hides/features/describes products but never prices them', async () => {
    const put = await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/menu/products/102', {
      visible: true, featured: true, displayOrder: 1, marketingDescription: 'Baked every morning', imageUrl: 'https://img.example/cookie.jpg'
    });
    assert.equal(put.status, 200);
    const hide = await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/menu/products/104', {
      visible: false, featured: false, displayOrder: null, marketingDescription: null, imageUrl: null
    });
    assert.equal(hide.status, 200);
    const pub = await publicCall(h.app, 'GET', `${BASE}/catalog`);
    assert.equal(pub.body.products[0].id, 102, 'featured first');
    assert.equal(pub.body.products[0].isFeatured, true);
    assert.equal(pub.body.products[0].description, 'Baked every morning');
    assert.equal(pub.body.products[0].priceCents, 2500, 'price is still Café’s');
    assert.ok(!pub.body.products.some((p: any) => p.id === 104));

    const price = await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/menu/products/102', {
      visible: true, featured: true, displayOrder: 1, marketingDescription: null, imageUrl: null, priceCents: 1
    });
    assert.equal(price.status, 400, 'there is no price field to set');

    // Presentation cannot resurrect what Café does not sell online.
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/menu/products/103', {
      visible: true, featured: true, displayOrder: 0, marketingDescription: null, imageUrl: null
    });
    const again = await publicCall(h.app, 'GET', `${BASE}/catalog`);
    assert.ok(!again.body.products.some((p: any) => p.id === 103));
    // A hidden product can't be ordered either.
    const order = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder({ items: [{ productId: 104, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined }));
    assert.equal(order.body.error.code, 'PRODUCT_INACTIVE');
  });

  test('presentation survives a re-sync', async () => {
    await cafe.connector.syncCatalog();
    const pub = await publicCall(h.app, 'GET', `${BASE}/catalog`);
    assert.equal(pub.body.products[0].id, 102);
    assert.equal(pub.body.products[0].description, 'Baked every morning');
  });
});

describe('tables', () => {
  test('tables come from Café; the admin can switch a table’s QR off', async () => {
    const ok = await publicCall(h.app, 'POST', `${BASE}/tables/resolve`, { token: 'tblA_window_0001' });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { tenantId: 'cafe-a', tableLabel: 'A1 — Window' });
    const list = await admin.request('GET', '/api/admin/v1/tenants/cafe-a/tables');
    assert.equal(list.body.tables.length, 1);
    assert.match(list.body.tables[0].qrUrl, /\?table=tblA_window_0001$/);
    const qr = await admin.request('GET', '/api/admin/v1/tenants/cafe-a/tables/1/qr.svg');
    assert.equal(qr.status, 200);
    assert.match(String(qr.body), /<svg/);

    await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/tables/1', { qrEnabled: false });
    const off = await publicCall(h.app, 'POST', `${BASE}/tables/resolve`, { token: 'tblA_window_0001' });
    assert.equal(off.status, 404);
    // A Café re-sync doesn't silently re-enable it.
    await cafe.connector.syncTables();
    assert.equal((await publicCall(h.app, 'POST', `${BASE}/tables/resolve`, { token: 'tblA_window_0001' })).status, 404);
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-a/tables/1', { qrEnabled: true });
  });
});

describe('order delivery to INBYTE Café', () => {
  test('happy path: queued → created in Café (ORD number, authoritative total) → status updates', async () => {
    const ack = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder());
    assert.equal(ack.status, 201);
    const hb = await cafe.connector.heartbeat();
    assert.ok(hb.pendingOrders >= 1);
    const done = await cafe.connector.processOrders();
    const mine = done.find((d) => d.publicReference === ack.body.publicReference);
    assert.equal(mine?.result.outcome, 'CREATED');
    const orderNumber = (mine!.result as { orderNumber: string }).orderNumber;

    let track = await publicCall(h.app, 'GET', `${BASE}/orders/${ack.body.publicReference}`);
    assert.equal(track.body.deliveryState, 'RECEIVED_BY_CAFE');
    assert.equal(track.body.orderNumber, orderNumber);
    assert.equal(track.body.totalCents, 13000);

    for (const [status, payment] of [['ACCEPTED', undefined], ['PREPARING', undefined], ['READY', undefined], ['COMPLETED', 'PAID']] as const) {
      const update = cafe.engine.staff(orderNumber, status, payment);
      assert.equal((await cafe.connector.reportStatus(ack.body.publicReference, update)).applied, true);
    }
    track = await publicCall(h.app, 'GET', `${BASE}/orders/${ack.body.publicReference}`);
    assert.equal(track.body.orderStatus, 'COMPLETED');
    assert.equal(track.body.paymentStatus, 'PAID');
  });

  test('lost result → lease expires → redelivered with the same clientRequestId → no duplicate in Café', async () => {
    const body = pickupOrder();
    const ack = await publicCall(h.app, 'POST', `${BASE}/orders`, body);
    const before = cafe.engine.createdCount;

    // Connector leases and Café creates the order, but the result never reaches the platform.
    const lease = await connectorCall(cafe.credential, 'POST', '/orders/lease', { max: 10 });
    const leased = lease.body.orders.find((o: any) => o.publicReference === ack.body.publicReference);
    assert.equal(leased.clientRequestId, body.clientRequestId);
    assert.equal(leased.order.expectedTotalCents, 13000);
    const first = cafe.engine.createOrder({ ...leased.order, clientRequestId: leased.clientRequestId });

    // Before the lease expires nobody else gets it.
    assert.equal((await connectorCall(cafe.credential, 'POST', '/orders/lease', { max: 10 })).body.orders.length, 0);
    h.clock.advance(61_000);
    const redelivered = await cafe.connector.processOrders();
    const again = redelivered.find((d) => d.publicReference === ack.body.publicReference);
    assert.deepEqual(again?.result, first, 'Café idempotency returns the original order');
    assert.equal(cafe.engine.createdCount, before + 1, 'exactly one Café order');

    const attempts = await h.db.query('SELECT delivery_attempts FROM orders WHERE public_reference = $1', [ack.body.publicReference]);
    assert.equal(attempts.rows[0].delivery_attempts, 2);
  });

  test('result reports are idempotent; contradictory reports are refused', async () => {
    const ack = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder());
    const [d] = (await cafe.connector.processOrders()).filter((x) => x.publicReference === ack.body.publicReference);
    const repeat = await cafe.connector.reportResult(ack.body.publicReference, d.result);
    assert.equal(repeat.applied, false);
    const contradict = await connectorCall(cafe.credential, 'POST', `/orders/${ack.body.publicReference}/result`, {
      outcome: 'CREATED', orderNumber: 'ORD-9999', orderStatus: 'PENDING', paymentStatus: 'PENDING', subtotalCents: 1, discountCents: 0, totalCents: 1
    });
    assert.equal(contradict.status, 409);
    // A result for an order that was never handed to Café is refused too.
    const fresh = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder());
    const premature = await connectorCall(cafe.credential, 'POST', `/orders/${fresh.body.publicReference}/result`, {
      outcome: 'REJECTED', errorCode: 'InsufficientStock'
    });
    assert.equal(premature.status, 409);
    await cafe.connector.processOrders(50);
  });

  test('status reports are versioned: stale ones are ignored, backwards moves refused', async () => {
    const ack = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder());
    const [d] = (await cafe.connector.processOrders()).filter((x) => x.publicReference === ack.body.publicReference);
    const orderNumber = (d.result as { orderNumber: string }).orderNumber;
    const accepted = cafe.engine.staff(orderNumber, 'ACCEPTED');
    const ready = cafe.engine.staff(orderNumber, 'READY');
    assert.equal((await cafe.connector.reportStatus(ack.body.publicReference, ready)).applied, true, 'steps may be skipped');
    assert.equal((await cafe.connector.reportStatus(ack.body.publicReference, accepted)).applied, false, 'older report ignored');
    const backwards = await connectorCall(cafe.credential, 'POST', `/orders/${ack.body.publicReference}/status`, {
      orderStatus: 'PENDING', paymentStatus: 'PENDING', statusVersion: 99
    });
    assert.equal(backwards.status, 409);
    const track = await publicCall(h.app, 'GET', `${BASE}/orders/${ack.body.publicReference}`);
    assert.equal(track.body.orderStatus, 'READY');
  });

  test('Café rejects an order when its authoritative price changed since the last sync', async () => {
    cafe.engine.setPrice(102, 2600); // POS price change not yet synced
    const ack = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder({ items: [{ productId: 102, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: 2500 }));
    assert.equal(ack.status, 201);
    const [d] = (await cafe.connector.processOrders()).filter((x) => x.publicReference === ack.body.publicReference);
    assert.equal(d.result.outcome, 'REJECTED');
    const track = await publicCall(h.app, 'GET', `${BASE}/orders/${ack.body.publicReference}`);
    assert.equal(track.body.orderStatus, 'REJECTED');
    assert.equal(track.body.deliveryState, 'RECEIVED_BY_CAFE');
    const admins = await admin.request('GET', `/api/admin/v1/tenants/cafe-a/orders/${ack.body.publicReference}`);
    assert.equal(admins.body.rejectionCode, 'PRICE_TAMPERED_MISMATCH');
    // After the next sync the website shows Café's new price.
    await cafe.connector.syncCatalog();
    const pub = await publicCall(h.app, 'GET', `${BASE}/catalog`);
    assert.equal(pub.body.products.find((p: any) => p.id === 102).priceCents, 2600);
  });

  test('stock is Café-only: an out-of-stock rejection reaches the customer', async () => {
    cafe.engine.outOfStock.add(101);
    const ack = await publicCall(h.app, 'POST', `${BASE}/orders`, pickupOrder());
    const [d] = (await cafe.connector.processOrders()).filter((x) => x.publicReference === ack.body.publicReference);
    assert.deepEqual(d.result, { outcome: 'REJECTED', errorCode: 'InsufficientStock' });
    cafe.engine.outOfStock.delete(101);
  });

  test('integration overview shows health, sync state and events', async () => {
    const res = await admin.request('GET', '/api/admin/v1/tenants/cafe-a/integration');
    assert.equal(res.status, 200);
    assert.equal(res.body.health, 'ONLINE');
    assert.equal(res.body.catalog.products, 4);
    assert.ok(res.body.events.some((e: any) => e.kind === 'catalog.synced'));
    // Only a short identifying prefix is shown; the credential itself is never returned again.
    assert.equal(res.body.connection.credentialPrefix, cafe.credential.slice(0, 12));
    assert.ok(!JSON.stringify(res.body).includes(cafe.credential));
  });
});
