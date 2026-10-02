// Build-time configuration (Vite `VITE_*` variables). Nothing secret belongs
// here: every value ends up in the public JavaScript bundle.
//
// Transport selection (VITE_CAFE_TRANSPORT) is decided in src/integration/index.ts
// so the bundler can strip the development mock from production builds.

import type { TenantStrategy } from '../tenant/tenantResolver';
import { parseHostMap } from '../tenant/tenantResolver';

function readTimeout(): number {
  const n = Number(import.meta.env.VITE_CAFE_API_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 ? n : 15000;
}

/** True for the development mock (dev server default, or an explicit mock build). */
const isMockBuild =
  import.meta.env.VITE_CAFE_TRANSPORT === 'mock' ||
  (import.meta.env.DEV && import.meta.env.VITE_CAFE_TRANSPORT !== 'http');

/** Production default: the INBYTE platform backend decides the café (paths, registered domains). */
function readStrategy(): TenantStrategy {
  const raw = import.meta.env.VITE_TENANT_STRATEGY;
  if (raw === 'subdomain' || raw === 'path' || raw === 'fixed' || raw === 'platform') return raw;
  return isMockBuild ? 'fixed' : 'platform';
}

/**
 * The platform backend serves the website and its API from the same origin,
 * so the default base URL is relative. `none` disables ordering entirely.
 */
function readApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_CAFE_API_BASE_URL ?? '').trim();
  if (raw === 'none') return '';
  return raw || '/api/public/v1';
}

export const appConfig = {
  /** Base URL of the INBYTE platform public API (same origin by default). */
  apiBaseUrl: readApiBaseUrl(),
  apiTimeoutMs: readTimeout(),
  /** Query parameter that carries the Café table token in the QR URL. */
  tableQrParam: (import.meta.env.VITE_TABLE_QR_PARAM ?? '').trim() || 'table',
  /** Tracking poll interval while an order is still in progress. */
  trackingPollMs: 10000,
  tenant: {
    strategy: readStrategy(),
    /** Tenant for the `fixed` strategy and fallback for the others. The mock defaults to its demo tenant. */
    fixedTenantId: (import.meta.env.VITE_TENANT_ID ?? '').trim() || (isMockBuild ? 'inbyte-demo' : null),
    baseDomain: (import.meta.env.VITE_TENANT_BASE_DOMAIN ?? '').trim() || null,
    pathPrefix: (import.meta.env.VITE_TENANT_PATH_PREFIX ?? 't').trim(),
    hostMap: parseHostMap(import.meta.env.VITE_TENANT_HOST_MAP),
    /** `?tenant=` switching is a development convenience only. */
    allowQueryOverride: isMockBuild,
    /**
     * Where tenant configuration is loaded from in http mode: the platform API
     * (default) or, for bootstrap/static demos only, a `/tenants/<id>.json` file.
     */
    configSource: import.meta.env.VITE_TENANT_CONFIG_SOURCE === 'static' ? ('static' as const) : ('api' as const)
  }
} as const;
