// Multi-tenancy: two cafés on one platform, configured only through the admin
// API, with overlapping Café IDs. Nothing crosses from café A to café B.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AdminSession, CafeSetup, Harness } from './helpers.ts';
import { SUPER_EMAIL, TABLES_A, TABLES_B, catalogA, catalogB, createHarness, login, onboardCafe, pickupOrder, publicCall } from './helpers.ts';

let h: Harness;
let admin: AdminSession;
let a: CafeSetup;
let b: CafeSetup;

before(async () => {
  h = await createHarness();
  admin = await login(h.app, SUPER_EMAIL);
  a = await onboardCafe(h, admin, 'cafe-a', catalogA(), TABLES_A);
  b = await onboardCafe(h, admin, 'cafe-b', catalogB(), TABLES_B, { delivery: false, paymentMethods: ['CREDIT_CARD'] });
});
after(async () => h.close());

const pub = (tenant: string, path: string) => `/api/public/v1/tenants/${tenant}${path}`;

describe('configuration without code changes', () => {
  test('branding, website content and ordering are per café and published through the website parser', async () => {
    const branding = await admin.request('PUT', '/api/admin/v1/tenants/cafe-b/sections/branding', {
      colors: { primary: '#1f7a80', accent: '#ffb703' },
      defaultTheme: 'light',
      fontFamily: 'Tajawal',
      fontStylesheetUrl: 'https://fonts.googleapis.com/css2?family=Tajawal'
    });
    assert.equal(branding.status, 200, JSON.stringify(branding.body));
    const website = await admin.request('PUT', '/api/admin/v1/tenants/cafe-b/sections/website', {
      heroTitle: 'Tea by the sea',
      announcement: { text: 'Closed Friday mornings', linkUrl: null },
      promotions: [{ title: 'Iced tea season', text: 'Back for summer' }],
      footerText: '© Café B'
    });
    assert.equal(website.status, 200, JSON.stringify(website.body));
    const contact = await admin.request('PUT', '/api/admin/v1/tenants/cafe-b/sections/contact', {
      phone: '+20 100 000 0002', address: 'Corniche, Alexandria', social: [{ label: 'Instagram', url: 'https://instagram.com/cafe-b' }],
      businessHoursText: 'Daily 8:00–23:00'
    });
    assert.equal(contact.status, 200);

    const cfgB = await publicCall(h.app, 'GET', pub('cafe-b', '/config'));
    assert.equal(cfgB.body.tenantId, 'cafe-b');
    assert.equal(cfgB.body.branding.colors.primary, '#1f7a80');
    assert.equal(cfgB.body.branding.defaultTheme, 'light');
    assert.equal(cfgB.body.content.heroTitle, 'Tea by the sea');
    assert.deepEqual(cfgB.body.content.announcement, { text: 'Closed Friday mornings', linkUrl: null });
    assert.equal(cfgB.body.features.delivery, false);
    assert.deepEqual(cfgB.body.paymentMethods, ['CREDIT_CARD']);

    const cfgA = await publicCall(h.app, 'GET', pub('cafe-a', '/config'));
    assert.equal(cfgA.body.branding.colors.primary, '#c8963e', 'café A untouched');
    assert.equal(cfgA.body.content.heroTitle, null);
    assert.equal(cfgA.body.content.announcement, null);
  });

  test('unsafe configuration is rejected', async () => {
    const bad = [
      ['branding', { colors: { primary: 'red; background:url(x)' }, defaultTheme: 'dark' }],
      ['branding', { colors: { primary: '#000000' }, defaultTheme: 'dark', fontStylesheetUrl: 'http://evil.example/x.css' }],
      ['identity', { logoUrl: 'javascript:alert(1)' }],
      ['contact', { website: 'javascript:alert(1)', social: [] }],
      ['website', { heroTitle: 'x', unknownField: true }],
      ['ordering', { onlineOrdering: true, pickup: true, delivery: true, dineInQr: true, paymentMethods: ['BITCOIN'], minimumOrderCents: null, deliveryAreaText: null, offlineOrderPolicy: 'REJECT', queueTtlMinutes: 15 }]
    ] as const;
    for (const [section, body] of bad) {
      const res = await admin.request('PUT', `/api/admin/v1/tenants/cafe-b/sections/${section}`, body);
      assert.equal(res.status, 400, `${section} ${JSON.stringify(body)}`);
    }
  });

  test('draft and disabled cafés do not exist publicly', async () => {
    await admin.request('POST', '/api/admin/v1/tenants', { tenantId: 'cafe-draft', displayName: 'Draft', currencyCode: 'EGP', currencySymbol: 'ج.م' });
    assert.equal((await publicCall(h.app, 'GET', pub('cafe-draft', '/config'))).status, 404);
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-b/status', { status: 'DISABLED' });
    const disabled = await publicCall(h.app, 'GET', pub('cafe-b', '/config'));
    assert.equal(disabled.status, 404);
    assert.equal(disabled.body.error.code, 'TENANT_NOT_FOUND');
    assert.equal((await publicCall(h.app, 'POST', pub('cafe-b', '/orders'), pickupOrder())).status, 404);
    await admin.request('PUT', '/api/admin/v1/tenants/cafe-b/status', { status: 'ACTIVE' });
    for (const id of ['unknown-cafe', 'A', '../cafe-a', "cafe-a' OR '1'='1"]) {
      assert.equal((await publicCall(h.app, 'GET', pub(encodeURIComponent(id), '/config'))).status, 404, id);
    }
  });
});

describe('data isolation', () => {
  test('same Café IDs, different cafés, different catalogs', async () => {
    const catA = await publicCall(h.app, 'GET', pub('cafe-a', '/catalog'));
    const catB = await publicCall(h.app, 'GET', pub('cafe-b', '/catalog'));
    assert.equal(catA.body.products.find((p: any) => p.id === 101).name, 'Latte');
    assert.equal(catB.body.products.find((p: any) => p.id === 101).name, 'Mint Tea');
    assert.equal(catB.body.products.length, 1);
    assert.equal(catB.body.tenantId, 'cafe-b');
  });

  test('a table token from café A is unknown at café B', async () => {
    assert.equal((await publicCall(h.app, 'POST', pub('cafe-a', '/tables/resolve'), { token: 'tblA_window_0001' })).status, 200);
    assert.equal((await publicCall(h.app, 'POST', pub('cafe-b', '/tables/resolve'), { token: 'tblA_window_0001' })).status, 404);
    const order = await publicCall(h.app, 'POST', pub('cafe-b', '/orders'), pickupOrder({
      orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: 'tblA_window_0001', customerInfo: {},
      items: [{ productId: 101, quantity: 1, modifierOptionIds: [] }], paymentMethod: 'CREDIT_CARD', expectedTotalCents: 3000
    }));
    assert.equal(order.body.error.code, 'INVALID_TABLE_TOKEN');
  });

  test('café A’s order reference is not found at café B', async () => {
    const ack = await publicCall(h.app, 'POST', pub('cafe-a', '/orders'), pickupOrder());
    assert.equal(ack.status, 201);
    assert.equal((await publicCall(h.app, 'GET', pub('cafe-a', `/orders/${ack.body.publicReference}`))).status, 200);
    const cross = await publicCall(h.app, 'GET', pub('cafe-b', `/orders/${ack.body.publicReference}`));
    assert.equal(cross.status, 404);
    assert.equal(cross.body.error.code, 'ORDER_NOT_FOUND');
  });

  test('idempotency keys are scoped per café', async () => {
    const shared = '11111111-1111-4111-8111-111111111111';
    const atA = await publicCall(h.app, 'POST', pub('cafe-a', '/orders'), pickupOrder({ clientRequestId: shared }));
    const atB = await publicCall(h.app, 'POST', pub('cafe-b', '/orders'), pickupOrder({
      clientRequestId: shared, items: [{ productId: 101, quantity: 1, modifierOptionIds: [] }], paymentMethod: 'CREDIT_CARD', expectedTotalCents: 3000
    }));
    assert.equal(atA.status, 201);
    assert.equal(atB.status, 201, 'not a conflict, not a replay of café A’s order');
    assert.notEqual(atA.body.publicReference, atB.body.publicReference);
  });

  test('café B’s connector never sees or touches café A’s orders', async () => {
    const ack = await publicCall(h.app, 'POST', pub('cafe-a', '/orders'), pickupOrder());
    const leasedByB = await b.connector.processOrders(50);
    assert.ok(leasedByB.every((o) => o.publicReference !== ack.body.publicReference));
    for (const path of [`/orders/${ack.body.publicReference}/result`, `/orders/${ack.body.publicReference}/status`]) {
      const res = await publicCall(h.app, 'POST', `/api/integration/v1${path}`, { outcome: 'REJECTED', errorCode: 'X', orderStatus: 'CANCELLED', paymentStatus: 'PENDING', statusVersion: 5 }, { authorization: `Bearer ${b.credential}` });
      assert.equal(res.status, 404, path);
    }
    const leasedByA = await a.connector.processOrders(50);
    assert.ok(leasedByA.some((o) => o.publicReference === ack.body.publicReference));
  });

  test('a connector can only push its own café’s catalog (the café comes from the credential)', async () => {
    const snapshot = { ...a.engine.catalogSnapshot(), tenantId: 'cafe-b' };
    await publicCall(h.app, 'PUT', '/api/integration/v1/catalog', snapshot, { authorization: `Bearer ${a.credential}` });
    const catB = await publicCall(h.app, 'GET', pub('cafe-b', '/catalog'));
    assert.equal(catB.body.products[0].name, 'Mint Tea');
  });

  test('admin order views are per café', async () => {
    const listA = await admin.request('GET', '/api/admin/v1/tenants/cafe-a/orders');
    const listB = await admin.request('GET', '/api/admin/v1/tenants/cafe-b/orders');
    const refsA = new Set(listA.body.orders.map((o: any) => o.publicReference));
    assert.ok(listB.body.orders.every((o: any) => !refsA.has(o.publicReference)));
    const cross = await admin.request('GET', `/api/admin/v1/tenants/cafe-b/orders/${listA.body.orders[0].publicReference}`);
    assert.equal(cross.status, 404);
  });
});

describe('domains', () => {
  test('a custom domain resolves to its café and cannot be used to reach another café', async () => {
    const add = await admin.request('POST', '/api/admin/v1/tenants/cafe-b/domains', { host: 'cafe-b.example', isPrimary: true });
    assert.equal(add.status, 200);
    const resolved = await publicCall(h.app, 'GET', '/api/public/v1/domains/resolve', undefined, { host: 'cafe-b.example' });
    assert.deepEqual(resolved.body, { tenantId: 'cafe-b' });
    assert.equal((await publicCall(h.app, 'GET', '/api/public/v1/domains/resolve', undefined, { host: 'unknown.example' })).status, 404);
    assert.equal((await publicCall(h.app, 'GET', pub('cafe-a', '/config'), undefined, { host: 'cafe-b.example' })).status, 404);
    assert.equal((await publicCall(h.app, 'GET', pub('cafe-b', '/config'), undefined, { host: 'cafe-b.example' })).status, 200);
    // One host belongs to one café.
    assert.equal((await admin.request('POST', '/api/admin/v1/tenants/cafe-a/domains', { host: 'cafe-b.example' })).status, 409);
    // QR links use the primary domain.
    const tables = await admin.request('GET', '/api/admin/v1/tenants/cafe-b/tables');
    assert.equal(tables.body.tables[0].qrUrl, 'https://cafe-b.example/?table=tblB_terrace_001');
  });
});
