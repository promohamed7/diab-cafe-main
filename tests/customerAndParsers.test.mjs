// Customer input validation and allow-list parsing of Café responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckoutInput, normalizePhone, LIMITS } from '../src/domain/customer.ts';
import {
  parseAcknowledgement,
  parseCafeTimestamp,
  parseCatalog,
  parseStatusSnapshot
} from '../src/integration/parsers.ts';
import { CafeIntegrationError } from '../src/integration/errors.ts';

const form = (o = {}) => ({ fullName: 'منى علي', phone: '010 5555 5555', deliveryAddress: '', notes: '', paymentMethod: 'CASH', ...o });

test('pickup/delivery need name and phone; delivery needs an address', () => {
  assert.deepEqual(validateCheckoutInput(form(), 'PICKUP').errors, {});
  assert.ok(validateCheckoutInput(form({ fullName: '' }), 'PICKUP').errors.fullName);
  assert.ok(validateCheckoutInput(form({ phone: '' }), 'DELIVERY').errors.phone);
  assert.ok(validateCheckoutInput(form(), 'DELIVERY').errors.deliveryAddress);
  assert.deepEqual(validateCheckoutInput(form({ deliveryAddress: 'سيدي سالم، شارع المحكمة' }), 'DELIVERY').errors, {});
});

test('dine-in contact details are optional but still validated when given', () => {
  assert.deepEqual(validateCheckoutInput(form({ fullName: '', phone: '' }), 'DINE_IN').errors, {});
  assert.ok(validateCheckoutInput(form({ phone: '12' }), 'DINE_IN').errors.phone);
});

test('length limits and phone normalisation', () => {
  assert.ok(validateCheckoutInput(form({ fullName: 'ا'.repeat(LIMITS.nameMax + 1) }), 'PICKUP').errors.fullName);
  assert.ok(validateCheckoutInput(form({ notes: 'x'.repeat(LIMITS.notesMax + 1) }), 'PICKUP').errors.notes);
  assert.ok(validateCheckoutInput(form({ deliveryAddress: 'x'.repeat(LIMITS.addressMax + 1) }), 'DELIVERY').errors.deliveryAddress);
  assert.equal(normalizePhone('٠١٠-٥٥٥٥-٥٥٥٥'), '01055555555');
  assert.equal(normalizePhone('+20 10 5555 5555'), '+201055555555');
  assert.equal(normalizePhone('call me'), '');
  assert.equal(validateCheckoutInput(form(), 'PICKUP').values.phone, '01055555555');
});

test('control characters are stripped from free text', () => {
  const { values } = validateCheckoutInput(form({ notes: 'بدون\u0000 سكر\u0007' }), 'PICKUP');
  assert.equal(values.notes, 'بدون سكر');
});

test('catalog parser keeps only allow-listed fields (no cost, barcode, stock)', () => {
  const raw = {
    store: { name: 'دياب', phone: '0100', address: null, ownerPin: '1234' },
    categories: [{ id: 1, name: 'قهوة', sortOrder: 1, isActive: true, isAvailableOnline: true, internalNote: 'x' }],
    products: [{
      id: 107, categoryId: 1, name: 'كابتشينو', priceCents: 5500, availability: 'AVAILABLE',
      costPriceCents: 1200, barcode: '622000', stock: 14, supplierId: 9, imageUrl: 'javascript:alert(1)',
      modifierGroups: [{ id: 11, name: 'الحجم', isRequired: true, allowMultiple: false,
        options: [{ id: 1101, name: 'عادي', priceDeltaCents: 0, costCents: 50 }] }]
    }, { id: 'bad', name: 'broken' }]
  };
  const parsed = parseCatalog(raw);
  const json = JSON.stringify(parsed);
  for (const leaked of ['costPriceCents', 'barcode', 'stock', 'supplierId', 'ownerPin', 'internalNote', 'costCents', 'javascript']) {
    assert.equal(json.includes(leaked), false, `${leaked} must not survive parsing`);
  }
  assert.equal(parsed.products.length, 1, 'malformed product skipped, menu still loads');
  assert.equal(parsed.products[0].imageUrl, null);
});

test('acknowledgement and status parsers reject unknown states and drop extras', () => {
  const ack = parseAcknowledgement({
    publicReference: 'ord_abc', orderNumber: 'ORD-1001', orderStatus: 'PENDING', paymentStatus: 'PENDING',
    totalCents: 5500, cashierName: 'Ali', shiftId: 3, customerPhone: '0100'
  });
  assert.deepEqual(Object.keys(ack).sort(), ['createdAt', 'deliveryState', 'discountCents', 'estimatedTotalCents', 'orderNumber', 'orderStatus', 'paymentStatus', 'publicReference', 'replayed', 'subtotalCents', 'totalCents']);
  // A synchronous integration that returns an order number has already delivered the order.
  assert.equal(ack.deliveryState, 'RECEIVED_BY_CAFE');
  assert.throws(() => parseAcknowledgement({ publicReference: 'x', orderNumber: 'y', orderStatus: 'PAID_BY_WEBSITE', paymentStatus: 'PENDING', totalCents: 1 }),
    (e) => e instanceof CafeIntegrationError && e.code === 'INVALID_RESPONSE');
  const snap = parseStatusSnapshot({ publicReference: 'ord_abc', orderNumber: 'ORD-1001', orderStatus: 'REJECTED', paymentStatus: 'PENDING', rejectionReason: 'نفد الصنف' });
  assert.equal(snap.rejectionReason, 'نفد الصنف');
});

test('platform acknowledgement: no order number or authoritative total until Café has the order', () => {
  const ack = parseAcknowledgement({
    tenantId: 'cafe-a', publicReference: 'INB-AAAA-BBBB-CCCC-DDDD', orderNumber: null, orderStatus: 'PENDING', paymentStatus: 'PENDING',
    deliveryState: 'AWAITING_CAFE', estimatedTotalCents: 13000, subtotalCents: null, discountCents: null, totalCents: null, replayed: false
  });
  assert.equal(ack.orderNumber, null);
  assert.equal(ack.totalCents, null);
  assert.equal(ack.discountCents, null);
  assert.equal(ack.estimatedTotalCents, 13000);
  assert.equal(ack.deliveryState, 'AWAITING_CAFE');
  const snap = parseStatusSnapshot({
    publicReference: 'INB-AAAA-BBBB-CCCC-DDDD', orderNumber: null, orderType: 'PICKUP', orderStatus: 'CANCELLED', paymentStatus: 'PENDING',
    deliveryState: 'NOT_DELIVERED', estimatedTotalCents: 13000, totalCents: null
  });
  assert.equal(snap.deliveryState, 'NOT_DELIVERED');
  assert.equal(snap.orderNumber, null);
  // Unknown delivery states fall back to what the order number implies, never to "received".
  assert.equal(parseStatusSnapshot({ publicReference: 'x', orderStatus: 'PENDING', paymentStatus: 'PENDING', deliveryState: 'TELEPORTED' }).deliveryState, 'AWAITING_CAFE');
});

test('Café zone-less timestamps are read as UTC', () => {
  assert.equal(parseCafeTimestamp('2026-10-02 08:30:00').toISOString(), '2026-10-02T08:30:00.000Z');
  assert.equal(parseCafeTimestamp('2026-10-02T08:30:00+02:00').toISOString(), '2026-10-02T06:30:00.000Z');
  assert.equal(parseCafeTimestamp('garbage'), null);
});
