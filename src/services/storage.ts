// Safe wrappers around browser storage. Storage can be unavailable (private
// mode, blocked site data) and the site must keep working without it.
//
// Only non-sensitive data is ever stored: cart IDs, UI preferences, the pending
// checkout snapshot and device-local tracking references. Never credentials.

type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson(key: string, kind: Area = 'local'): unknown {
  try {
    const raw = area(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, kind: Area = 'local'): void {
  try {
    area(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / availability errors.
  }
}

export function readString(key: string, kind: Area = 'local'): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string, kind: Area = 'local'): void {
  try {
    area(kind)?.setItem(key, value);
  } catch {
    // Ignore.
  }
}

export function removeKey(key: string, kind: Area = 'local'): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    // Ignore.
  }
}

/**
 * Keys written by the old prototype (fake user, simulated orders, default table,
 * client-priced cart). They are removed on startup so stale demo data — and in
 * particular a stale dine-in table — can never leak into a real order.
 */
const LEGACY_KEYS = [
  'inbyte_cafe_cart',
  'inbyte_cafe_order_mode',
  'inbyte_cafe_orders',
  'inbyte_active_order_id',
  'inbyte_cafe_user',
  'inbyte_cafe_table_num'
];

export function purgeLegacyPrototypeData(): void {
  for (const key of LEGACY_KEYS) removeKey(key);
}
