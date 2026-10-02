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

function readStrategy(): TenantStrategy {
  const raw = import.meta.env.VITE_TENANT_STRATEGY;
  return raw === 'subdomain' || raw === 'path' ? raw : 'fixed';
}

/** True for the development mock (dev server default, or an explicit mock build). */
const isMockBuild =
  import.meta.env.VITE_CAFE_TRANSPORT === 'mock' ||
  (import.meta.env.DEV && import.meta.env.VITE_CAFE_TRANSPORT !== 'http');

export const appConfig = {
  /** Base URL of the Café integration adapter/relay. No default: unset means ordering is unavailable. */
  apiBaseUrl: (import.meta.env.VITE_CAFE_API_BASE_URL ?? '').trim(),
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
    /** Where tenant configuration is loaded from in http mode: a static JSON file or the relay. */
    configSource: import.meta.env.VITE_TENANT_CONFIG_SOURCE === 'api' ? ('api' as const) : ('static' as const)
  }
} as const;
