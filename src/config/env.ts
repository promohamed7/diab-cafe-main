// Build-time configuration (Vite `VITE_*` variables). Nothing secret belongs
// here: every value ends up in the public JavaScript bundle.
//
// Transport selection (VITE_CAFE_TRANSPORT) is decided in src/integration/index.ts
// so the bundler can strip the development mock from production builds.

function readTimeout(): number {
  const n = Number(import.meta.env.VITE_CAFE_API_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 15000;
}

export const appConfig = {
  /** Base URL of the Café integration adapter/relay. No default: unset means ordering is unavailable. */
  apiBaseUrl: (import.meta.env.VITE_CAFE_API_BASE_URL ?? '').trim(),
  apiTimeoutMs: readTimeout(),
  /** Query parameter that carries the Café table token in the QR URL. */
  tableQrParam: (import.meta.env.VITE_TABLE_QR_PARAM ?? '').trim() || 'table',
  /** Tracking poll interval while an order is still in progress. */
  trackingPollMs: 10000
} as const;
