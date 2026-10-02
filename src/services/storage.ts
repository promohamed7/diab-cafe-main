// Global (non-tenant) storage housekeeping. All customer state is stored per
// tenant through src/tenant/scopedStorage.ts; nothing here holds café data.

/**
 * Unscoped keys written by earlier versions (the single-café prototype and the
 * first single-tenant release). They can't be attributed to a café, so they are
 * removed on startup rather than risk showing one café's cart, table or order
 * inside another.
 */
const LEGACY_KEYS = [
  'inbyte_cafe_cart',
  'inbyte_cafe_order_mode',
  'inbyte_cafe_orders',
  'inbyte_active_order_id',
  'inbyte_cafe_user',
  'inbyte_cafe_table_num',
  'inbyte_cart_v2',
  'inbyte_checkout_attempt_v1',
  'inbyte_tracked_orders_v1',
  'inbyte_catalog_cache_v1',
  'inbyte_outside_order_type',
  'inbyte-cafe-theme',
  'inbyte_dev_mock_state_v1'
];
const LEGACY_SESSION_KEYS = ['inbyte_table_session_v1', 'inbyte_checkout_attempt_v1'];

export function purgeLegacyData(): void {
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable.
  }
  try {
    for (const key of LEGACY_SESSION_KEYS) window.sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable.
  }
}
