// HTTP transport error mapping and the development mock's Café-like, tenant-isolated behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpTransport, createUnconfiguredTransport } from '../src/integration/httpTransport.ts';
import { CafeIntegrationError } from '../src/integration/errors.ts';
import { createMockTransport } from '../src/integration/mock/mockTransport.ts';
import { assertTenantEcho, parseCatalog } from '../src/integration/parsers.ts';
import { buildCatalogIndex } from '../src/domain/catalogIndex.ts';
import { estimateUnitCents } from '../src/domain/pricing.ts';
import { generateRequestId } from '../src/domain/checkoutAttempt.ts';

const A = 'inbyte-demo';
const B = 'harbor-roast';
const isCode = (code) => (e) => e instanceof CafeIntegrationError && e.code === code;

function jsonResponse(status, body) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('http: tenant-scoped paths, idempotency key, no credentials, ApiResponse envelopes', async () => {
  const seen = [];
  const transport = createHttpTransport({
    baseUrl: 'https://relay.example/api/',
    timeoutMs: 5000,
    fetchImpl: async (url, init) => {
      seen.push({ url, init });
      return jsonResponse(201, { success: true, data: { ok: 1 } });
    }
  });
  const req = { clientRequestId: generateRequestId(), orderType: 'PICKUP', orderChannel: 'ONLINE', items: [], customerInfo: {}, paymentMethod: 'CASH' };
  assert.deepEqual(await transport.submitOrder(A, req), { ok: 1 });
  await transport.getCatalog(B);
  await transport.getOrderStatus(A, 'ord/../x');
  await transport.resolveTableToken(B, 'hr_tbl_8f2a71c4e9b3d605');
  await transport.getTenantConfig(A);
  assert.deepEqual(seen.map((s) => s.url), [
    'https://relay.example/api/tenants/inbyte-demo/orders',
    'https://relay.example/api/tenants/harbor-roast/catalog',
    'https://relay.example/api/tenants/inbyte-demo/orders/ord%2F..%2Fx',
    'https://relay.example/api/tenants/harbor-roast/tables/resolve',
    'https://relay.example/api/tenants/inbyte-demo/config'
  ]);
  assert.equal(seen[0].init.credentials, 'omit');
  assert.equal(seen[0].init.headers['Idempotency-Key'], req.clientRequestId);
  assert.equal(JSON.parse(seen[0].init.body).clientRequestId, req.clientRequestId);
});

test('http: Café domain errors map to structured codes; server messages are not exposed', async () => {
  const cases = [
    [{ error: { code: 'PriceTamperedMismatch', message: 'SELECT * FROM orders failed at services.rs:4181' } }, 'PRICE_TAMPERED_MISMATCH', false],
    [{ error: { code: 'IdempotencyKeyConflict' } }, 'IDEMPOTENCY_KEY_CONFLICT', false],
    [{ error: { code: 'INSUFFICIENT_STOCK' } }, 'INSUFFICIENT_STOCK', false],
    [{ error: { code: 'InvalidTableToken' } }, 'INVALID_TABLE_TOKEN', false],
    [{ error: { code: 'TenantNotFound' } }, 'TENANT_NOT_FOUND', false],
    [{}, 'SERVICE_UNAVAILABLE', true]
  ];
  for (const [body, code, unknown] of cases) {
    const transport = createHttpTransport({ baseUrl: 'https://r', timeoutMs: 5000, fetchImpl: async () => jsonResponse(code === 'SERVICE_UNAVAILABLE' ? 503 : 422, body) });
    await assert.rejects(transport.getCatalog(A), (e) => {
      assert.ok(isCode(code)(e), `${code} got ${e.code}`);
      assert.equal(e.outcomeUnknown, unknown);
      assert.equal(e.message.includes('SELECT'), false);
      return true;
    });
  }
});

test('http: network failures and timeouts are "outcome unknown"', async () => {
  const offline = createHttpTransport({ baseUrl: 'https://r', timeoutMs: 5000, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.getCatalog(A), (e) => isCode('NETWORK_ERROR')(e) && e.outcomeUnknown);

  const slow = createHttpTransport({
    baseUrl: 'https://r',
    timeoutMs: 20,
    fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
  });
  await assert.rejects(slow.getCatalog(A), (e) => isCode('TIMEOUT')(e) && e.outcomeUnknown);

  const garbage = createHttpTransport({ baseUrl: 'https://r', timeoutMs: 5000, fetchImpl: async () => new Response('<html>', { status: 200 }) });
  await assert.rejects(garbage.getCatalog(A), (e) => isCode('INVALID_RESPONSE')(e) && e.outcomeUnknown);
});

test('unconfigured transport never fakes success', async () => {
  const t = createUnconfiguredTransport();
  await assert.rejects(t.submitOrder(A, {}), isCode('NOT_CONFIGURED'));
  await assert.rejects(t.getCatalog(A), isCode('NOT_CONFIGURED'));
  await assert.rejects(t.getTenantConfig(A), isCode('NOT_CONFIGURED'));
});

test('responses echoing another tenant are rejected', () => {
  assert.doesNotThrow(() => assertTenantEcho({ tenantId: A }, A));
  assert.doesNotThrow(() => assertTenantEcho({ orderNumber: 'ORD-1' }, A), 'no echo is accepted');
  assert.throws(() => assertTenantEcho({ tenantId: B }, A), isCode('INVALID_RESPONSE'));
});

// ---------------- Development mock ----------------

const TABLE_A = 'qr_7c1e4b9a2f6d4e08';
const TABLE_B = 'hr_tbl_8f2a71c4e9b3d605';

async function setup(mock = createMockTransport()) {
  const index = buildCatalogIndex(parseCatalog(await mock.getCatalog(A)));
  // Cappuccino (107): size + sugar are required.
  const product = index.productsById.get(107);
  const options = [1101, 1303];
  const expected = estimateUnitCents(product, options);
  const order = (o = {}) => ({
    orderType: 'PICKUP',
    orderChannel: 'ONLINE',
    items: [{ productId: 107, quantity: 1, modifierOptionIds: options }],
    customerInfo: { fullName: 'منى', phone: '01055555555' },
    paymentMethod: 'CASH',
    expectedTotalCents: expected,
    clientRequestId: generateRequestId(),
    ...o
  });
  return { mock, index, order, expected };
}

/** A valid Harbor Roast pickup order (latte 5102 with required cup size). */
function harborOrder(o = {}) {
  return {
    orderType: 'PICKUP',
    orderChannel: 'ONLINE',
    items: [{ productId: 5102, quantity: 1, modifierOptionIds: [6101] }],
    customerInfo: { fullName: 'سارة', phone: '01066666666' },
    paymentMethod: 'CREDIT_CARD',
    expectedTotalCents: 7000,
    clientRequestId: generateRequestId(),
    ...o
  };
}

test('mock: catalog filters offline products and uses integer IDs', async () => {
  const { index } = await setup();
  assert.equal(index.productsById.has(1301), false, 'add-on marked not-online is hidden');
  assert.ok(index.products.every((p) => Number.isInteger(p.id) && Number.isInteger(p.categoryId)));
});

test('mock: creates PENDING orders with Café numbers and non-guessable references', async () => {
  const { mock, order, expected } = await setup();
  const a = await mock.submitOrder(A, order());
  const b = await mock.submitOrder(A, order());
  assert.equal(a.orderStatus, 'PENDING');
  assert.equal(a.paymentStatus, 'PENDING');
  assert.equal(a.totalCents, expected);
  assert.equal(a.tenantId, A);
  assert.match(a.orderNumber, /^ORD-\d+$/);
  assert.match(a.publicReference, /^ord_[0-9a-f]{32}$/);
  assert.notEqual(a.publicReference, b.publicReference);
});

test('mock: same clientRequestId + same payload replays the original order once', async () => {
  const { mock, order } = await setup();
  const req = order();
  const first = await mock.submitOrder(A, req);
  const again = await mock.submitOrder(A, req);
  assert.equal(again.replayed, true);
  assert.equal(again.publicReference, first.publicReference);
  assert.equal(mock.controls.listOrders(A).length, 1);
});

test('mock: same clientRequestId with a different payload is a conflict', async () => {
  const { mock, order } = await setup();
  const req = order();
  await mock.submitOrder(A, req);
  await assert.rejects(mock.submitOrder(A, { ...req, customerInfo: { fullName: 'شخص آخر', phone: '01000000000' } }), isCode('IDEMPOTENCY_KEY_CONFLICT'));
});

test('mock: lost response then retry with the same id → exactly one order', async () => {
  const { mock, order } = await setup();
  const req = order();
  mock.controls.failNextSubmit(A, 'TIMEOUT_AFTER_COMMIT');
  await assert.rejects(mock.submitOrder(A, req), (e) => isCode('TIMEOUT')(e) && e.outcomeUnknown);
  const retry = await mock.submitOrder(A, req);
  assert.equal(retry.replayed, true);
  assert.equal(mock.controls.listOrders(A).length, 1);
  assert.deepEqual(mock.controls.receivedRequestIds(A), [req.clientRequestId, req.clientRequestId]);
});

test('mock: validation mirrors the Café contract', async () => {
  const { mock, order, expected } = await setup();
  await assert.rejects(mock.submitOrder(A, order({ expectedTotalCents: expected - 100 })), isCode('PRICE_TAMPERED_MISMATCH'));
  await assert.rejects(mock.submitOrder(A, order({ items: [{ productId: 107, quantity: 1, modifierOptionIds: [1101] }] })), isCode('INVALID_MODIFIER_OPTION'));
  await assert.rejects(mock.submitOrder(A, order({ items: [{ productId: 107, quantity: 1, modifierOptionIds: [1101, 1102, 1303] }] })), isCode('INVALID_MODIFIER_OPTION'));
  await assert.rejects(mock.submitOrder(A, order({ items: [{ productId: 1301, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined })), isCode('PRODUCT_UNAVAILABLE'));
  await assert.rejects(mock.submitOrder(A, order({ items: [{ productId: 103, quantity: 1, modifierOptionIds: [1101, 1303] }], expectedTotalCents: undefined })), isCode('INSUFFICIENT_STOCK'));
  await assert.rejects(mock.submitOrder(A, order({ customerInfo: { fullName: 'منى' } })), isCode('CUSTOMER_DATA_REQUIRED'));
  await assert.rejects(mock.submitOrder(A, order({ orderType: 'DELIVERY' })), isCode('CUSTOMER_DATA_REQUIRED'));
  await assert.rejects(mock.submitOrder(A, order({ orderType: 'DINE_IN' })), isCode('VALIDATION_FAILED'), 'DINE_IN is not allowed on ONLINE');
  await assert.rejects(mock.submitOrder(A, order({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: 'tbl_04' })), isCode('INVALID_TABLE_TOKEN'));
  assert.equal(mock.controls.listOrders(A).length, 0, 'no rejected request created an order');

  const dineIn = await mock.submitOrder(A, order({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: TABLE_A, customerInfo: {} }));
  assert.equal(dineIn.orderStatus, 'PENDING');
});

test('mock: price changes are reflected in the catalog and enforced at checkout', async () => {
  const { mock, order } = await setup();
  mock.controls.setPriceDrift(A, 500);
  await assert.rejects(mock.submitOrder(A, order()), isCode('PRICE_TAMPERED_MISMATCH'));
  const fresh = buildCatalogIndex(parseCatalog(await mock.getCatalog(A)));
  const newTotal = estimateUnitCents(fresh.productsById.get(107), [1101, 1303]);
  const ok = await mock.submitOrder(A, order({ expectedTotalCents: newTotal }));
  assert.equal(ok.totalCents, newTotal);
});

test('mock: tables resolve only from Café-issued tokens; tracking is read-only by reference', async () => {
  const { mock, order } = await setup();
  assert.deepEqual(await mock.resolveTableToken(A, TABLE_A), { tenantId: A, tableLabel: 'طاولة 1 — الصالة الرئيسية' });
  await assert.rejects(mock.resolveTableToken(A, 'tbl_04'), isCode('INVALID_TABLE_TOKEN'));

  const ack = await mock.submitOrder(A, order());
  mock.controls.setOrderStatus(A, ack.publicReference, 'REJECTED', 'نفد الصنف');
  const snap = await mock.getOrderStatus(A, ack.publicReference);
  assert.equal(snap.orderStatus, 'REJECTED');
  assert.equal(snap.rejectionReason, 'نفد الصنف');
  await assert.rejects(mock.getOrderStatus(A, 'ORD-1001'), isCode('ORDER_NOT_FOUND'), 'order numbers are not tracking credentials');
});

// ---------------- Multi-tenant isolation ----------------

test('tenants: each café loads its own config and catalog', async () => {
  const mock = createMockTransport();
  const configA = await mock.getTenantConfig(A);
  const configB = await mock.getTenantConfig(B);
  assert.equal(configA.tenantId, A);
  assert.equal(configB.tenantId, B);
  assert.notEqual(configA.identity.displayName, configB.identity.displayName);

  const catA = parseCatalog(await mock.getCatalog(A));
  const catB = parseCatalog(await mock.getCatalog(B));
  const idsA = new Set(catA.products.map((p) => p.id));
  const idsB = new Set(catB.products.map((p) => p.id));
  assert.equal([...idsA].some((id) => idsB.has(id)), false, 'no product shared between the two menus');
  assert.notDeepEqual(catA.categories.map((c) => c.name), catB.categories.map((c) => c.name));
  assert.notEqual(catA.store.name, catB.store.name);
  await assert.rejects(mock.getTenantConfig('unknown-cafe'), isCode('TENANT_NOT_FOUND'));
  await assert.rejects(mock.getCatalog('unknown-cafe'), isCode('TENANT_NOT_FOUND'));
});

test('tenants: a table token from café A is invalid at café B (resolve and order)', async () => {
  const mock = createMockTransport();
  await assert.rejects(mock.resolveTableToken(B, TABLE_A), isCode('INVALID_TABLE_TOKEN'));
  await assert.rejects(mock.resolveTableToken(A, TABLE_B), isCode('INVALID_TABLE_TOKEN'));
  await assert.rejects(
    mock.submitOrder(B, harborOrder({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: TABLE_A, customerInfo: {} })),
    isCode('INVALID_TABLE_TOKEN')
  );
  const ok = await mock.submitOrder(B, harborOrder({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: TABLE_B, customerInfo: {} }));
  assert.equal(ok.tenantId, B);
});

test('tenants: a tracking reference from café A cannot be queried at café B', async () => {
  const { mock, order } = await setup();
  const ack = await mock.submitOrder(A, order());
  assert.equal((await mock.getOrderStatus(A, ack.publicReference)).orderNumber, ack.orderNumber);
  await assert.rejects(mock.getOrderStatus(B, ack.publicReference), isCode('ORDER_NOT_FOUND'));
});

test('tenants: idempotency keys are scoped — the same clientRequestId at café B never replays café A', async () => {
  const { mock, order } = await setup();
  const key = generateRequestId();
  const a = await mock.submitOrder(A, order({ clientRequestId: key }));
  const b = await mock.submitOrder(B, harborOrder({ clientRequestId: key }));
  assert.equal(b.replayed, false, 'not a replay of café A');
  assert.notEqual(b.publicReference, a.publicReference);
  assert.equal(b.tenantId, B);
  assert.equal(mock.controls.listOrders(A).length, 1);
  assert.equal(mock.controls.listOrders(B).length, 1);
  assert.deepEqual(mock.controls.receivedRequestIds(A), [key]);
  assert.deepEqual(mock.controls.receivedRequestIds(B), [key]);
});

test('tenants: products of café A are unknown at café B', async () => {
  const { mock, order } = await setup();
  await assert.rejects(mock.submitOrder(B, { ...order(), paymentMethod: 'CREDIT_CARD' }), isCode('PRODUCT_INACTIVE'));
  assert.equal(mock.controls.listOrders(B).length, 0);
});

test('tenants: dev controls and faults are per café', async () => {
  const { mock, order } = await setup();
  mock.controls.setPriceDrift(B, 1000);
  mock.controls.failNextSubmit(B, 'NETWORK_ERROR');
  const okA = await mock.submitOrder(A, order()); // A is unaffected by B's drift and fault
  assert.equal(okA.replayed, false);
  await assert.rejects(mock.submitOrder(B, harborOrder({ expectedTotalCents: 8000 })), isCode('NETWORK_ERROR'));
  assert.equal((await mock.submitOrder(B, harborOrder({ expectedTotalCents: 8000 }))).totalCents, 8000);
});

test('tenants: state persists per café across transport instances (shared storage)', async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const first = createMockTransport({ storage });
  const { order } = await setup(first);
  const ack = await first.submitOrder(A, order());
  const second = createMockTransport({ storage });
  assert.equal((await second.getOrderStatus(A, ack.publicReference)).publicReference, ack.publicReference);
  await assert.rejects(second.getOrderStatus(B, ack.publicReference), isCode('ORDER_NOT_FOUND'));
});
