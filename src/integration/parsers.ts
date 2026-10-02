// Allow-list parsers for data arriving from the Café integration layer.
//
// Only the fields listed in the website contract are copied. Anything else the
// server sends (cost prices, barcodes, cashier or shift data, PII of other
// orders...) is dropped here and never reaches React state or storage.

import type {
  AvailabilityHint,
  CafeCatalog,
  CatalogCategory,
  CatalogModifierGroup,
  CatalogModifierOption,
  CatalogProduct
} from '../types/catalog.ts';
import type {
  CafeOrderStatus,
  CafePaymentStatus,
  OrderAcknowledgement,
  OrderStatusSnapshot,
  OrderType
} from '../types/order.ts';
import type { ResolvedTable } from '../types/table.ts';
import { CafeIntegrationError } from './errors.ts';

type Obj = Record<string, unknown>;

const ORDER_STATUSES: readonly CafeOrderStatus[] = [
  'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED'
];
const PAYMENT_STATUSES: readonly CafePaymentStatus[] = [
  'PENDING', 'SUBMITTED', 'VERIFICATION_REQUIRED', 'VERIFIED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'
];
const ORDER_TYPES: readonly OrderType[] = ['PICKUP', 'DELIVERY', 'DINE_IN'];

/**
 * If the integration echoes a tenantId, it must be the tenant we asked about.
 * Defence in depth: a relay bug must not show one café's data inside another.
 */
export function assertTenantEcho(raw: unknown, tenantId: string): void {
  if (isObj(raw) && raw.tenantId !== undefined && raw.tenantId !== tenantId) invalid();
}

function invalid(): never {
  throw new CafeIntegrationError('INVALID_RESPONSE');
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function obj(v: unknown): Obj {
  return isObj(v) ? v : invalid();
}

function id(v: unknown): number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : invalid();
}

function cents(v: unknown): number {
  return typeof v === 'number' && Number.isSafeInteger(v) ? v : invalid();
}

function str(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : invalid();
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : invalid();
}

/** Only http(s) image URLs are rendered; anything else is ignored. */
function safeImageUrl(v: unknown): string | null {
  const s = optStr(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function availability(v: unknown): AvailabilityHint {
  return v === 'AVAILABLE' || v === 'UNAVAILABLE' ? v : 'UNKNOWN';
}

function parseOption(raw: unknown): CatalogModifierOption {
  const o = obj(raw);
  return { id: id(o.id), name: str(o.name), priceDeltaCents: cents(o.priceDeltaCents ?? 0) };
}

function parseGroup(raw: unknown): CatalogModifierGroup {
  const g = obj(raw);
  const options = Array.isArray(g.options) ? g.options.map(parseOption) : [];
  return {
    id: id(g.id),
    name: str(g.name),
    isRequired: bool(g.isRequired, false),
    allowMultiple: bool(g.allowMultiple, false),
    options
  };
}

function parseCategory(raw: unknown): CatalogCategory {
  const c = obj(raw);
  return {
    id: id(c.id),
    name: str(c.name),
    sortOrder: typeof c.sortOrder === 'number' && Number.isFinite(c.sortOrder) ? c.sortOrder : 0,
    isActive: bool(c.isActive, true),
    isAvailableOnline: bool(c.isAvailableOnline, true)
  };
}

function parseProduct(raw: unknown): CatalogProduct {
  const p = obj(raw);
  const groups = Array.isArray(p.modifierGroups) ? p.modifierGroups.map(parseGroup) : [];
  return {
    id: id(p.id),
    categoryId: id(p.categoryId),
    name: str(p.name),
    description: optStr(p.description),
    imageUrl: safeImageUrl(p.imageUrl),
    priceCents: cents(p.priceCents),
    isActive: bool(p.isActive, true),
    isAvailableOnline: bool(p.isAvailableOnline, true),
    availability: availability(p.availability),
    isFeatured: p.isFeatured === true,
    modifierGroups: groups
  };
}

/** Skip malformed entries instead of failing the whole menu. */
function parseList<T>(raw: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(raw)) invalid();
  const out: T[] = [];
  for (const item of raw) {
    try {
      out.push(parse(item));
    } catch {
      // A single malformed item must not take the whole menu down.
    }
  }
  return out;
}

export function parseCatalog(raw: unknown): CafeCatalog {
  const root = obj(raw);
  const store = isObj(root.store) ? root.store : {};
  return {
    store: {
      name: optStr(store.name) ?? '',
      phone: optStr(store.phone),
      address: optStr(store.address)
    },
    categories: parseList(root.categories, parseCategory),
    products: parseList(root.products, parseProduct),
    version: optStr(root.version)
  };
}

export function parseResolvedTable(raw: unknown): ResolvedTable {
  const t = obj(raw);
  return { tableLabel: str(t.tableLabel) };
}

export function parseAcknowledgement(raw: unknown): OrderAcknowledgement {
  const a = obj(raw);
  return {
    publicReference: str(a.publicReference),
    orderNumber: str(a.orderNumber),
    orderStatus: oneOf(a.orderStatus, ORDER_STATUSES),
    paymentStatus: oneOf(a.paymentStatus, PAYMENT_STATUSES),
    subtotalCents: cents(a.subtotalCents ?? a.totalCents),
    discountCents: cents(a.discountCents ?? 0),
    totalCents: cents(a.totalCents),
    createdAt: optStr(a.createdAt),
    replayed: a.replayed === true
  };
}

export function parseStatusSnapshot(raw: unknown): OrderStatusSnapshot {
  const s = obj(raw);
  return {
    publicReference: str(s.publicReference),
    orderNumber: str(s.orderNumber),
    orderType: typeof s.orderType === 'string' && (ORDER_TYPES as readonly string[]).includes(s.orderType)
      ? (s.orderType as OrderType)
      : null,
    orderStatus: oneOf(s.orderStatus, ORDER_STATUSES),
    paymentStatus: oneOf(s.paymentStatus, PAYMENT_STATUSES),
    totalCents: typeof s.totalCents === 'number' && Number.isSafeInteger(s.totalCents) ? s.totalCents : null,
    rejectionReason: optStr(s.rejectionReason),
    updatedAt: optStr(s.updatedAt)
  };
}

/**
 * Café timestamps may arrive as `YYYY-MM-DD HH:MM:SS` (UTC, no zone) or RFC 3339.
 * Browsers parse the first form inconsistently, so normalise before display.
 */
export function parseCafeTimestamp(value: string | null): Date | null {
  if (!value) return null;
  const naive = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(value);
  const iso = naive ? `${naive[1]}T${naive[2]}${naive[3] ?? ''}Z` : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
