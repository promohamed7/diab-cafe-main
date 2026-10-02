// Display-only price estimates. Café recalculates every order; these numbers are
// never sent as prices. The cart total is sent only as `expectedTotalCents`, a
// sanity check Café uses to reject an order if its menu changed.

import type { CafeId, CatalogProduct } from '../types/catalog.ts';
import { findOption } from './catalogIndex.ts';

/** Mirrors Café's rule: unit = selling price + Σ option deltas. */
export function estimateUnitCents(product: CatalogProduct, optionIds: readonly CafeId[]): number {
  let unit = product.priceCents;
  for (const optionId of optionIds) {
    const ref = findOption(product, optionId);
    if (ref) unit += ref.option.priceDeltaCents;
  }
  return unit;
}

export function estimateLineCents(product: CatalogProduct, optionIds: readonly CafeId[], quantity: number): number {
  return estimateUnitCents(product, optionIds) * quantity;
}

export function formatMoney(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const pounds = Math.floor(abs / 100);
  const piastres = abs % 100;
  const body = piastres === 0 ? String(pounds) : `${pounds}.${String(piastres).padStart(2, '0')}`;
  return `${sign}${body} ج.م`;
}
