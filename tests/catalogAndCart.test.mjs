// Catalog filtering, modifier rules, display pricing and cart behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogIndex } from '../src/domain/catalogIndex.ts';
import { toggleModifierOption, validateModifierSelection } from '../src/domain/modifiers.ts';
import { estimateUnitCents, formatMoney } from '../src/domain/pricing.ts';
import {
  addCartLine,
  estimateCartTotal,
  reconcileCart,
  sanitizeStoredCart,
  setCartLineQuantity,
  MAX_CART_LINES,
  MAX_QUANTITY_PER_LINE
} from '../src/domain/cart.ts';

const size = { id: 11, name: 'الحجم', isRequired: true, allowMultiple: false, options: [
  { id: 1101, name: 'عادي', priceDeltaCents: 0 }, { id: 1102, name: 'كبير', priceDeltaCents: 1500 }
] };
const syrups = { id: 15, name: 'سيرب', isRequired: false, allowMultiple: true, options: [
  { id: 1501, name: 'فانيليا', priceDeltaCents: 1500 }, { id: 1502, name: 'كراميل', priceDeltaCents: 1500 }
] };
const milk = { id: 12, name: 'حليب', isRequired: false, allowMultiple: false, options: [
  { id: 1201, name: 'كامل', priceDeltaCents: 0 }, { id: 1203, name: 'شوفان', priceDeltaCents: 1500 }
] };

function product(id, overrides = {}) {
  return {
    id, categoryId: 1, name: `p${id}`, description: null, imageUrl: null, priceCents: 5000,
    isActive: true, isAvailableOnline: true, availability: 'AVAILABLE', modifierGroups: [size, milk, syrups],
    ...overrides
  };
}

const catalog = {
  store: { name: 'x', phone: null, address: null },
  version: null,
  categories: [
    { id: 1, name: 'قهوة', sortOrder: 2, isActive: true, isAvailableOnline: true },
    { id: 2, name: 'مخفي', sortOrder: 1, isActive: true, isAvailableOnline: false },
    { id: 3, name: 'فارغ', sortOrder: 3, isActive: true, isAvailableOnline: true }
  ],
  products: [
    product(1),
    product(2, { isAvailableOnline: false }),
    product(3, { isActive: false }),
    product(4, { categoryId: 2 }),
    product(5, { availability: 'UNAVAILABLE' })
  ]
};

test('catalog index hides inactive/offline products and categories and empty categories', () => {
  const index = buildCatalogIndex(catalog);
  assert.deepEqual(index.products.map((p) => p.id), [1, 5]);
  assert.deepEqual(index.categories.map((c) => c.id), [1]);
  assert.equal(index.productsById.has(2), false);
  assert.equal(index.productsById.has(4), false);
});

test('required groups must be chosen; single-select groups allow one option', () => {
  const p = product(1);
  assert.deepEqual(validateModifierSelection(p, []).map((i) => i.kind), ['REQUIRED_MISSING']);
  assert.deepEqual(validateModifierSelection(p, [1101]), []);
  assert.deepEqual(validateModifierSelection(p, [1101, 1102]).map((i) => i.kind), ['TOO_MANY_IN_SINGLE_GROUP']);
  assert.deepEqual(validateModifierSelection(p, [1101, 1101]).map((i) => i.kind), ['DUPLICATE_OPTION']);
  assert.deepEqual(validateModifierSelection(p, [1101, 9999]).map((i) => i.kind), ['UNKNOWN_OPTION']);
  assert.deepEqual(validateModifierSelection(p, [1101, 1501, 1502]), []);
});

test('toggling respects single vs multi select', () => {
  const p = product(1);
  let sel = toggleModifierOption(p, [], 1101);
  sel = toggleModifierOption(p, sel, 1102);
  assert.deepEqual(sel, [1102], 'single-select replaces');
  assert.deepEqual(toggleModifierOption(p, sel, 1102), [1102], 'a required choice cannot be cleared');
  sel = toggleModifierOption(p, sel, 1203);
  assert.deepEqual(toggleModifierOption(p, sel, 1203), [1102], 'an optional single choice can be cleared');
  sel = toggleModifierOption(p, toggleModifierOption(p, sel, 1501), 1502);
  assert.deepEqual(sel, [1102, 1203, 1501, 1502], 'multi-select adds');
  assert.deepEqual(toggleModifierOption(p, sel, 1501), [1102, 1203, 1502], 'multi-select removes');
});

test('display price follows Café rule: base + Σ deltas', () => {
  assert.equal(estimateUnitCents(product(1), [1102, 1203, 1501]), 5000 + 1500 + 1500 + 1500);
  assert.equal(formatMoney(5500), '55 ج.م');
  assert.equal(formatMoney(5550), '55.50 ج.م');
  assert.equal(formatMoney(null), '—');
});

test('cart stores IDs only, merges identical lines and enforces limits', () => {
  let n = 0;
  const id = () => `l${++n}`;
  let r = addCartLine([], 1, [1203, 1101], 2, id);
  assert.deepEqual(r.lines, [{ lineId: 'l1', productId: 1, quantity: 2, modifierOptionIds: [1101, 1203] }]);
  r = addCartLine(r.lines, 1, [1101, 1203], 3, id);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].quantity, 5);
  assert.equal(addCartLine(r.lines, 1, [1101, 1203], MAX_QUANTITY_PER_LINE, id).reason, 'QUANTITY_LIMIT');

  let lines = [];
  for (let i = 0; i < MAX_CART_LINES; i++) lines = addCartLine(lines, 100 + i, [], 1, id).lines;
  assert.equal(addCartLine(lines, 999, [], 1, id).reason, 'CART_FULL');

  assert.equal(setCartLineQuantity(r.lines, 'l1', 0).length, 0);
  assert.equal(setCartLineQuantity(r.lines, 'l1', 500)[0].quantity, MAX_QUANTITY_PER_LINE);
});

test('cart reconciliation flags lines Café no longer offers', () => {
  const index = buildCatalogIndex(catalog);
  const lines = [
    { lineId: 'a', productId: 1, quantity: 2, modifierOptionIds: [1101] },
    { lineId: 'b', productId: 2, quantity: 1, modifierOptionIds: [1101] },
    { lineId: 'c', productId: 5, quantity: 1, modifierOptionIds: [1101] },
    { lineId: 'd', productId: 1, quantity: 1, modifierOptionIds: [] }
  ];
  const rec = reconcileCart(lines, index);
  assert.deepEqual(rec.map((r) => r.issue), [null, 'PRODUCT_NOT_IN_MENU', 'PRODUCT_UNAVAILABLE', 'INVALID_MODIFIERS']);
  assert.equal(estimateCartTotal(rec), null, 'no total while a line cannot be priced');
  assert.equal(estimateCartTotal(reconcileCart([lines[0]], index)), 10000);
});

test('stored carts from the old prototype (names/prices) are discarded', () => {
  const legacy = [{ id: 'item_x', productId: 107, productName: 'كابتشينو', unitPriceCents: 1, totalCents: 1, quantity: 1, modifiers: {} }];
  assert.deepEqual(sanitizeStoredCart(legacy), []);
  const current = [{ lineId: 'a', productId: 107, quantity: 99, modifierOptionIds: [3, 1, 'x'], unitPriceCents: 1 }];
  assert.deepEqual(sanitizeStoredCart(current), [{ lineId: 'a', productId: 107, quantity: MAX_QUANTITY_PER_LINE, modifierOptionIds: [1, 3] }]);
});
