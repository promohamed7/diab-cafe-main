// clientRequestId lifecycle and order payload shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderDraft,
  fingerprintDraft,
  generateRequestId,
  resolveAttempt,
  sanitizeStoredAttempt,
  ATTEMPT_REUSE_TTL_MS
} from '../src/domain/checkoutAttempt.ts';

const T = 'inbyte-demo';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const baseCustomer = {
  fullName: 'منى علي',
  phone: '01055555555',
  deliveryAddress: 'سيدي سالم، شارع المحكمة، عمارة 4',
  notes: '',
  paymentMethod: 'CASH'
};

function input(overrides = {}) {
  return {
    orderType: 'PICKUP',
    tableToken: null,
    lines: [{ productId: 107, quantity: 1, modifierOptionIds: [1303, 1101] }],
    customer: { ...baseCustomer },
    expectedTotalCents: 5500,
    ...overrides
  };
}

let seq = 0;
const fakeId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

test('PICKUP payload: ONLINE channel, IDs only, no table, no address', () => {
  const draft = buildOrderDraft(input());
  assert.deepEqual(draft, {
    orderType: 'PICKUP',
    orderChannel: 'ONLINE',
    items: [{ productId: 107, quantity: 1, modifierOptionIds: [1101, 1303] }],
    customerInfo: { fullName: 'منى علي', phone: '01055555555' },
    paymentMethod: 'CASH',
    expectedTotalCents: 5500
  });
});

test('DELIVERY payload includes the address; DINE_IN uses TABLE_QR and the exact token', () => {
  const delivery = buildOrderDraft(input({ orderType: 'DELIVERY' }));
  assert.equal(delivery.orderChannel, 'ONLINE');
  assert.equal(delivery.customerInfo.deliveryAddress, baseCustomer.deliveryAddress);
  assert.equal('tableToken' in delivery, false);

  const token = 'qr_7c1e4b9a2f6d4e08';
  const dineIn = buildOrderDraft(input({ orderType: 'DINE_IN', tableToken: token }));
  assert.equal(dineIn.orderChannel, 'TABLE_QR');
  assert.equal(dineIn.tableToken, token);
  assert.equal('deliveryAddress' in dineIn.customerInfo, false);
});

test('outside orders never carry a table token, even if one is passed', () => {
  const draft = buildOrderDraft(input({ orderType: 'PICKUP', tableToken: 'qr_7c1e4b9a2f6d4e08' }));
  assert.equal('tableToken' in draft, false);
});

test('DINE_IN without a Café token is refused', () => {
  assert.throws(() => buildOrderDraft(input({ orderType: 'DINE_IN', tableToken: null })), /TABLE_TOKEN_REQUIRED/);
});

test('payload contains no price, status, number, discount, cashier or shift fields', () => {
  const json = JSON.stringify(buildOrderDraft(input({ orderType: 'DELIVERY' })));
  for (const forbidden of [
    'unitPrice', 'lineTotal', 'totalCents"', 'subtotal', 'discount', 'orderStatus', 'paymentStatus',
    'orderNumber', 'orderId', 'orderSecret', 'cashier', 'shift', 'deliveryFee'
  ]) {
    assert.equal(json.includes(forbidden), false, `payload must not contain ${forbidden}`);
  }
});

test('generateRequestId returns unique RFC 4122 v4 UUIDs', () => {
  const ids = new Set(Array.from({ length: 500 }, generateRequestId));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, UUID_V4);
});

test('a new attempt gets a fresh id; an unknown-outcome retry of the same payload reuses it', () => {
  const draft = buildOrderDraft(input());
  const first = resolveAttempt(null, draft, { tenantId: T, newId: fakeId });
  assert.equal(first.reused, false);

  const unknown = { ...first.attempt, status: 'OUTCOME_UNKNOWN', sendCount: 1 };
  const retry = resolveAttempt(unknown, buildOrderDraft(input()), { tenantId: T, newId: fakeId });
  assert.equal(retry.reused, true);
  assert.equal(retry.attempt.clientRequestId, first.attempt.clientRequestId);

  // A crash after persisting but before the response also counts as unknown.
  const pending = { ...first.attempt, status: 'PENDING_SEND' };
  assert.equal(resolveAttempt(pending, buildOrderDraft(input()), { tenantId: T, newId: fakeId }).attempt.clientRequestId, first.attempt.clientRequestId);
});

test('any change to the checkout input produces a NEW clientRequestId', () => {
  const original = resolveAttempt(null, buildOrderDraft(input()), { tenantId: T, newId: fakeId }).attempt;
  const unknown = { ...original, status: 'OUTCOME_UNKNOWN' };
  const variants = {
    cart: input({ lines: [...input().lines, { productId: 201, quantity: 1, modifierOptionIds: [] }] }),
    quantity: input({ lines: [{ productId: 107, quantity: 2, modifierOptionIds: [1101, 1303] }] }),
    modifiers: input({ lines: [{ productId: 107, quantity: 1, modifierOptionIds: [1102, 1303] }] }),
    orderType: input({ orderType: 'DELIVERY' }),
    name: input({ customer: { ...baseCustomer, fullName: 'منى أحمد' } }),
    phone: input({ customer: { ...baseCustomer, phone: '01066666666' } }),
    notes: input({ customer: { ...baseCustomer, notes: 'بدون سكر' } }),
    payment: input({ customer: { ...baseCustomer, paymentMethod: 'CREDIT_CARD' } }),
    expectedTotal: input({ expectedTotalCents: 6000 })
  };
  for (const [name, variant] of Object.entries(variants)) {
    const next = resolveAttempt(unknown, buildOrderDraft(variant), { tenantId: T, newId: fakeId });
    assert.equal(next.reused, false, `${name} change must not reuse the id`);
    assert.notEqual(next.attempt.clientRequestId, original.clientRequestId, name);
  }

  const deliveryUnknown = { ...resolveAttempt(null, buildOrderDraft(input({ orderType: 'DELIVERY' })), { tenantId: T, newId: fakeId }).attempt, status: 'OUTCOME_UNKNOWN' };
  const newAddress = input({ orderType: 'DELIVERY', customer: { ...baseCustomer, deliveryAddress: 'عنوان آخر مختلف تماماً' } });
  assert.equal(resolveAttempt(deliveryUnknown, buildOrderDraft(newAddress), { tenantId: T, newId: fakeId }).reused, false, 'address');

  const dineUnknown = { ...resolveAttempt(null, buildOrderDraft(input({ orderType: 'DINE_IN', tableToken: 'qr_7c1e4b9a2f6d4e08' })), { tenantId: T, newId: fakeId }).attempt, status: 'OUTCOME_UNKNOWN' };
  const otherTable = input({ orderType: 'DINE_IN', tableToken: 'qr_a93f02d6c8b14e7f' });
  assert.equal(resolveAttempt(dineUnknown, buildOrderDraft(otherTable), { tenantId: T, newId: fakeId }).reused, false, 'table token');
});

test('acknowledged or definitively rejected attempts are never reused', () => {
  const draft = buildOrderDraft(input());
  const attempt = resolveAttempt(null, draft, { tenantId: T, newId: fakeId }).attempt;
  for (const status of ['ACKNOWLEDGED', 'REJECTED']) {
    const next = resolveAttempt({ ...attempt, status }, draft, { tenantId: T, newId: fakeId });
    assert.equal(next.reused, false, status);
    assert.notEqual(next.attempt.clientRequestId, attempt.clientRequestId, status);
  }
});

test('very old unknown attempts are not silently reused', () => {
  const draft = buildOrderDraft(input());
  const attempt = { ...resolveAttempt(null, draft, { tenantId: T, newId: fakeId, now: 0 }).attempt, status: 'OUTCOME_UNKNOWN' };
  assert.equal(resolveAttempt(attempt, draft, { tenantId: T, newId: fakeId, now: ATTEMPT_REUSE_TTL_MS + 1 }).reused, false);
});

test('fingerprint is independent of key order but sensitive to item order', () => {
  const a = buildOrderDraft(input());
  const reordered = Object.fromEntries(Object.entries(a).reverse());
  assert.equal(fingerprintDraft(reordered), fingerprintDraft(a));
  const twoLines = input({ lines: [{ productId: 1, quantity: 1, modifierOptionIds: [] }, { productId: 2, quantity: 1, modifierOptionIds: [] }] });
  const swapped = input({ lines: [...twoLines.lines].reverse() });
  assert.notEqual(fingerprintDraft(buildOrderDraft(twoLines)), fingerprintDraft(buildOrderDraft(swapped)));
});

test('stored attempts are validated: tampered payloads are discarded', () => {
  const attempt = resolveAttempt(null, buildOrderDraft(input()), { tenantId: T, newId: generateRequestId }).attempt;
  assert.deepEqual(sanitizeStoredAttempt(JSON.parse(JSON.stringify(attempt)), T), attempt);

  const tampered = JSON.parse(JSON.stringify(attempt));
  tampered.request.items[0].quantity = 9;
  assert.equal(sanitizeStoredAttempt(tampered, T), null);
  assert.equal(sanitizeStoredAttempt({ ...attempt, clientRequestId: 'not-a-uuid' }, T), null);
  assert.equal(sanitizeStoredAttempt(null, T), null);
});

test('an attempt belongs to one tenant: never reused, restored or fingerprinted across cafés', () => {
  const draft = buildOrderDraft(input());
  const a = resolveAttempt(null, draft, { tenantId: 'cafe-a', newId: generateRequestId }).attempt;
  assert.equal(a.tenantId, 'cafe-a');
  const unknownA = { ...a, status: 'OUTCOME_UNKNOWN' };

  // Identical payload, other café → brand-new clientRequestId.
  const b = resolveAttempt(unknownA, draft, { tenantId: 'cafe-b', newId: generateRequestId });
  assert.equal(b.reused, false);
  assert.notEqual(b.attempt.clientRequestId, a.clientRequestId);
  assert.equal(b.attempt.tenantId, 'cafe-b');
  assert.notEqual(b.attempt.fingerprint, a.fingerprint, 'tenant is part of the fingerprint');

  // A stored attempt is only restored for its own café.
  const stored = JSON.parse(JSON.stringify(unknownA));
  assert.equal(sanitizeStoredAttempt(stored, 'cafe-b'), null);
  assert.equal(sanitizeStoredAttempt(stored, 'cafe-a').clientRequestId, a.clientRequestId);
  // Relabelling the tenant without the matching fingerprint is rejected too.
  assert.equal(sanitizeStoredAttempt({ ...stored, tenantId: 'cafe-b' }, 'cafe-b'), null);
});
