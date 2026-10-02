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

/** Formats minor units with the tenant's currency symbol (e.g. "ج.م"). Display only. */
export function formatMoney(cents: number | null | undefined, currencySymbol: string): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const body = minor === 0 ? String(major) : `${major}.${String(minor).padStart(2, '0')}`;
  return `${sign}${body} ${currencySymbol}`;
}
