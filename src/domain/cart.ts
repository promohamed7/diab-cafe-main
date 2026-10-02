// Cart model: only Café IDs and quantities. Names and prices are looked up from
// the current catalog at render time and are never stored as authority.

import type { CafeId } from '../types/catalog.ts';
import type { CatalogIndex } from './catalogIndex.ts';
import { isOrderable } from './catalogIndex.ts';
import { normalizeOptionIds, validateModifierSelection } from './modifiers.ts';
import { estimateLineCents } from './pricing.ts';

export const MAX_QUANTITY_PER_LINE = 20;
export const MAX_CART_LINES = 25;

export interface CartLine {
  /** Local UI key only. Never sent to Café. */
  lineId: string;
  productId: CafeId;
  quantity: number;
  modifierOptionIds: CafeId[];
}

export type CartLineIssue = 'PRODUCT_NOT_IN_MENU' | 'PRODUCT_UNAVAILABLE' | 'INVALID_MODIFIERS';

export interface ReconciledLine {
  line: CartLine;
  issue: CartLineIssue | null;
  /** Estimated line total, or null when the product is no longer in the menu. */
  estimatedCents: number | null;
}

export interface CartAddResult {
  lines: CartLine[];
  ok: boolean;
  reason?: 'CART_FULL' | 'QUANTITY_LIMIT';
}

function sameSelection(a: CartLine, productId: CafeId, optionIds: readonly CafeId[]): boolean {
  if (a.productId !== productId || a.modifierOptionIds.length !== optionIds.length) return false;
  return a.modifierOptionIds.every((id, i) => id === optionIds[i]);
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY_PER_LINE, Math.max(1, Math.floor(quantity)));
}

/** Adds a line, merging it into an identical existing line when there is one. */
export function addCartLine(
  lines: readonly CartLine[],
  productId: CafeId,
  modifierOptionIds: readonly CafeId[],
  quantity: number,
  newLineId: () => string
): CartAddResult {
  const optionIds = normalizeOptionIds(modifierOptionIds);
  const qty = clampQuantity(quantity);
  const existing = lines.find((l) => sameSelection(l, productId, optionIds));
  if (existing) {
    const merged = existing.quantity + qty;
    if (merged > MAX_QUANTITY_PER_LINE) return { lines: [...lines], ok: false, reason: 'QUANTITY_LIMIT' };
    return {
      lines: lines.map((l) => (l === existing ? { ...l, quantity: merged } : l)),
      ok: true
    };
  }
  if (lines.length >= MAX_CART_LINES) return { lines: [...lines], ok: false, reason: 'CART_FULL' };
  return {
    lines: [...lines, { lineId: newLineId(), productId, quantity: qty, modifierOptionIds: optionIds }],
    ok: true
  };
}

export function setCartLineQuantity(lines: readonly CartLine[], lineId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.lineId !== lineId);
  return lines.map((l) => (l.lineId === lineId ? { ...l, quantity: clampQuantity(quantity) } : l));
}

export function removeCartLine(lines: readonly CartLine[], lineId: string): CartLine[] {
  return lines.filter((l) => l.lineId !== lineId);
}

export function reconcileCart(lines: readonly CartLine[], index: CatalogIndex | null): ReconciledLine[] {
  return lines.map((line) => {
    if (!index) return { line, issue: null, estimatedCents: null };
    const product = index.productsById.get(line.productId);
    if (!product) return { line, issue: 'PRODUCT_NOT_IN_MENU', estimatedCents: null };
    const estimatedCents = estimateLineCents(product, line.modifierOptionIds, line.quantity);
    if (!isOrderable(product)) return { line, issue: 'PRODUCT_UNAVAILABLE', estimatedCents };
    if (validateModifierSelection(product, line.modifierOptionIds).length > 0) {
      return { line, issue: 'INVALID_MODIFIERS', estimatedCents };
    }
    return { line, issue: null, estimatedCents };
  });
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Estimated total of the valid lines, or null when any line can't be priced. */
export function estimateCartTotal(reconciled: readonly ReconciledLine[]): number | null {
  let total = 0;
  for (const r of reconciled) {
    if (r.estimatedCents === null) return null;
    total += r.estimatedCents;
  }
  return total;
}

/** Restores a cart from storage, dropping anything that isn't a well-formed ID line. */
export function sanitizeStoredCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CartLine[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.lineId !== 'string' || !Number.isSafeInteger(r.productId) || !Number.isSafeInteger(r.quantity)) continue;
    const ids = Array.isArray(r.modifierOptionIds) ? r.modifierOptionIds.filter((v) => Number.isSafeInteger(v)) : [];
    out.push({
      lineId: r.lineId,
      productId: r.productId as number,
      quantity: clampQuantity(r.quantity as number),
      modifierOptionIds: normalizeOptionIds(ids as number[])
    });
    if (out.length >= MAX_CART_LINES) break;
  }
  return out;
}
