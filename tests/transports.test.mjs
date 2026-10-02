// HTTP transport error mapping and the development mock's Café-like behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpTransport, createUnconfiguredTransport } from '../src/integration/httpTransport.ts';
import { CafeIntegrationError } from '../src/integration/errors.ts';
import { createMockTransport } from '../src/integration/mock/mockTransport.ts';
import { parseCatalog } from '../src/integration/parsers.ts';
import { buildCatalogIndex } from '../src/domain/catalogIndex.ts';
import { estimateUnitCents } from '../src/domain/pricing.ts';
import { generateRequestId } from '../src/domain/checkoutAttempt.ts';

const isCode = (code) => (e) => e instanceof CafeIntegrationError && e.code === code;

function jsonResponse(status, body) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('http: sends the idempotency key, omits credentials and unwraps ApiResponse envelopes', async () => {
  let seen;
  const transport = createHttpTransport({
    baseUrl: 'https://relay.example/api/',
    timeoutMs: 5000,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return jsonResponse(201, { success: true, data: { ok: 1 } });
    }
  });
  const req = { clientRequestId: generateRequestId(), orderType: 'PICKUP', orderChannel: 'ONLINE', items: [], customerInfo: {}, paymentMethod: 'CASH' };
  assert.deepEqual(await transport.submitOrder(req), { ok: 1 });
  assert.equal(seen.url, 'https://relay.example/api/orders');
  assert.equal(seen.init.credentials, 'omit');
  assert.equal(seen.init.headers['Idempotency-Key'], req.clientRequestId);
  assert.equal(JSON.parse(seen.init.body).clientRequestId, req.clientRequestId);
});

test('http: Café domain errors map to structured codes; server messages are not exposed', async () => {
  const cases = [
    [{ error: { code: 'PriceTamperedMismatch', message: 'SELECT * FROM orders failed at services.rs:4181' } }, 'PRICE_TAMPERED_MISMATCH', false],
    [{ error: { code: 'IdempotencyKeyConflict' } }, 'IDEMPOTENCY_KEY_CONFLICT', false],
    [{ error: { code: 'INSUFFICIENT_STOCK' } }, 'INSUFFICIENT_STOCK', false],
    [{ error: { code: 'InvalidTableToken' } }, 'INVALID_TABLE_TOKEN', false],
    [{}, 'SERVICE_UNAVAILABLE', true]
  ];
  for (const [body, code, unknown] of cases) {
    const transport = createHttpTransport({ baseUrl: 'https://r', timeoutMs: 5000, fetchImpl: async () => jsonResponse(code === 'SERVICE_UNAVAILABLE' ? 503 : 422, body) });
    await assert.rejects(transport.getCatalog(), (e) => {
      assert.ok(isCode(code)(e), `${code} got ${e.code}`);
      assert.equal(e.outcomeUnknown, unknown);
      assert.equal(e.message.includes('SELECT'), false);
      return true;
    });
  }
});

test('http: network failures and timeouts are "outcome unknown"', async () => {
  const offline = createHttpTransport({ baseUrl: 'https://r', timeoutMs: 5000, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.getCatalog(), (e) => isCode('NETWORK_ERROR')(e) && e.outcomeUnknown);

  const slow = createHttpTransport({
    baseUrl: 'https://r',
    timeoutMs: 20,
    fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
  });
  await assert.rejects(slow.getCatalog(), (e) => isCode('TIMEOUT')(e) && e.outcomeUnknown);

  const garbage = createHttpTransport({ baseUrl: 'https://r', timeoutMs: 5000, fetchImpl: async () => new Response('<html>', { status: 200 }) });
  await assert.rejects(garbage.getCatalog(), (e) => isCode('INVALID_RESPONSE')(e) && e.outcomeUnknown);
});

test('unconfigured transport never fakes success', async () => {
  const t = createUnconfiguredTransport();
  await assert.rejects(t.submitOrder({}), isCode('NOT_CONFIGURED'));
  await assert.rejects(t.getCatalog(), isCode('NOT_CONFIGURED'));
});

// ---------------- Development mock ----------------

const TABLE = 'qr_7c1e4b9a2f6d4e08';

async function setup() {
  const mock = createMockTransport();
  const index = buildCatalogIndex(parseCatalog(await mock.getCatalog()));
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

test('mock: catalog filters offline products and uses integer IDs', async () => {
  const { index } = await setup();
  assert.equal(index.productsById.has(1301), false, 'add-on marked not-online is hidden');
  assert.ok(index.products.every((p) => Number.isInteger(p.id) && Number.isInteger(p.categoryId)));
});

test('mock: creates PENDING orders with Café numbers and non-guessable references', async () => {
  const { mock, order, expected } = await setup();
  const a = await mock.submitOrder(order());
  const b = await mock.submitOrder(order());
  assert.equal(a.orderStatus, 'PENDING');
  assert.equal(a.paymentStatus, 'PENDING');
  assert.equal(a.totalCents, expected);
  assert.match(a.orderNumber, /^ORD-\d+$/);
  assert.match(a.publicReference, /^ord_[0-9a-f]{32}$/);
  assert.notEqual(a.publicReference, b.publicReference);
});

test('mock: same clientRequestId + same payload replays the original order once', async () => {
  const { mock, order } = await setup();
  const req = order();
  const first = await mock.submitOrder(req);
  const again = await mock.submitOrder(req);
  assert.equal(again.replayed, true);
  assert.equal(again.publicReference, first.publicReference);
  assert.equal(mock.controls.listOrders().length, 1);
});

test('mock: same clientRequestId with a different payload is a conflict', async () => {
  const { mock, order } = await setup();
  const req = order();
  await mock.submitOrder(req);
  await assert.rejects(mock.submitOrder({ ...req, customerInfo: { fullName: 'شخص آخر', phone: '01000000000' } }), isCode('IDEMPOTENCY_KEY_CONFLICT'));
});

test('mock: lost response then retry with the same id → exactly one order', async () => {
  const { mock, order } = await setup();
  const req = order();
  mock.controls.failNextSubmit('TIMEOUT_AFTER_COMMIT');
  await assert.rejects(mock.submitOrder(req), (e) => isCode('TIMEOUT')(e) && e.outcomeUnknown);
  const retry = await mock.submitOrder(req);
  assert.equal(retry.replayed, true);
  assert.equal(mock.controls.listOrders().length, 1);
  assert.deepEqual(mock.controls.receivedRequestIds(), [req.clientRequestId, req.clientRequestId]);
});

test('mock: validation mirrors the Café contract', async () => {
  const { mock, order, expected } = await setup();
  await assert.rejects(mock.submitOrder(order({ expectedTotalCents: expected - 100 })), isCode('PRICE_TAMPERED_MISMATCH'));
  await assert.rejects(mock.submitOrder(order({ items: [{ productId: 107, quantity: 1, modifierOptionIds: [1101] }] })), isCode('INVALID_MODIFIER_OPTION'));
  await assert.rejects(mock.submitOrder(order({ items: [{ productId: 107, quantity: 1, modifierOptionIds: [1101, 1102, 1303] }] })), isCode('INVALID_MODIFIER_OPTION'));
  await assert.rejects(mock.submitOrder(order({ items: [{ productId: 1301, quantity: 1, modifierOptionIds: [] }], expectedTotalCents: undefined })), isCode('PRODUCT_UNAVAILABLE'));
  await assert.rejects(mock.submitOrder(order({ items: [{ productId: 103, quantity: 1, modifierOptionIds: [1101, 1303] }], expectedTotalCents: undefined })), isCode('INSUFFICIENT_STOCK'));
  await assert.rejects(mock.submitOrder(order({ customerInfo: { fullName: 'منى' } })), isCode('CUSTOMER_DATA_REQUIRED'));
  await assert.rejects(mock.submitOrder(order({ orderType: 'DELIVERY' })), isCode('CUSTOMER_DATA_REQUIRED'));
  await assert.rejects(mock.submitOrder(order({ orderType: 'DINE_IN' })), isCode('VALIDATION_FAILED'), 'DINE_IN is not allowed on ONLINE');
  await assert.rejects(mock.submitOrder(order({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: 'tbl_04' })), isCode('INVALID_TABLE_TOKEN'));
  assert.equal(mock.controls.listOrders().length, 0, 'no rejected request created an order');

  const dineIn = await mock.submitOrder(order({ orderType: 'DINE_IN', orderChannel: 'TABLE_QR', tableToken: TABLE, customerInfo: {} }));
  assert.equal(dineIn.orderStatus, 'PENDING');
});

test('mock: price changes are reflected in the catalog and enforced at checkout', async () => {
  const { mock, order } = await setup();
  mock.controls.setPriceDrift(500);
  await assert.rejects(mock.submitOrder(order()), isCode('PRICE_TAMPERED_MISMATCH'));
  const fresh = buildCatalogIndex(parseCatalog(await mock.getCatalog()));
  const newTotal = estimateUnitCents(fresh.productsById.get(107), [1101, 1303]);
  const ok = await mock.submitOrder(order({ expectedTotalCents: newTotal }));
  assert.equal(ok.totalCents, newTotal);
});

test('mock: tables resolve only from Café-issued tokens; tracking is read-only by reference', async () => {
  const { mock, order } = await setup();
  assert.deepEqual(await mock.resolveTableToken(TABLE), { tableLabel: 'طاولة 1 — الصالة الرئيسية' });
  await assert.rejects(mock.resolveTableToken('tbl_04'), isCode('INVALID_TABLE_TOKEN'));

  const ack = await mock.submitOrder(order());
  mock.controls.setOrderStatus(ack.publicReference, 'REJECTED', 'نفد الصنف');
  const snap = await mock.getOrderStatus(ack.publicReference);
  assert.equal(snap.orderStatus, 'REJECTED');
  assert.equal(snap.rejectionReason, 'نفد الصنف');
  await assert.rejects(mock.getOrderStatus('ORD-1001'), isCode('ORDER_NOT_FOUND'), 'order numbers are not tracking credentials');
});
