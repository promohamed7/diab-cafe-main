// Decides which café (tenant) the visitor is looking at.
//
// The strategy is configuration, not code, so the same build can later serve
//   fixed      — one tenant per deployment (VITE_TENANT_ID), the current default
//   subdomain  — cafe-a.menu.example.com  (VITE_TENANT_BASE_DOMAIN=menu.example.com)
//   path       — menu.example.com/t/cafe-a/   (VITE_TENANT_PATH_PREFIX=t)
//   host map   — custom domains, e.g. {"cafe-a.com":"cafe-a"} (VITE_TENANT_HOST_MAP)
//   platform   — the INBYTE platform decides: /t/<tenantId>/ paths, otherwise the
//                backend maps the request's hostname (custom domains and
//                subdomains registered in the INBYTE Admin) to a café
// A `?tenant=` override exists only for development/mock builds.
//
// URL segments are treated as tenant IDs; every value is validated.

import { TENANT_ID_PATTERN } from './parseTenantConfig.ts';

export type TenantStrategy = 'fixed' | 'subdomain' | 'path' | 'platform';
export type TenantSource = 'query' | 'host-map' | 'subdomain' | 'path' | 'platform-host' | 'fixed';

export interface TenantResolverOptions {
  strategy: TenantStrategy;
  /** Tenant for the `fixed` strategy, and fallback for the others. */
  fixedTenantId: string | null;
  /** Domain under which tenants are subdomains (subdomain strategy). */
  baseDomain: string | null;
  /** First path segment before the tenant id (path strategy), e.g. "t". Empty = tenant is the first segment. */
  pathPrefix: string;
  /** Exact hostname → tenantId map for custom domains. Checked before the strategy. */
  hostMap: Record<string, string>;
  /** Development only: honour `?tenant=`. */
  allowQueryOverride: boolean;
}

export interface LocationLike {
  hostname: string;
  pathname: string;
  search: string;
}

export interface ResolvedTenant {
  tenantId: string;
  source: TenantSource;
}

function valid(id: string | null | undefined): string | null {
  if (!id) return null;
  const v = id.trim().toLowerCase();
  return TENANT_ID_PATTERN.test(v) ? v : null;
}

export function resolveTenant(location: LocationLike, options: TenantResolverOptions): ResolvedTenant | null {
  if (options.allowQueryOverride) {
    const fromQuery = valid(new URLSearchParams(location.search).get('tenant'));
    if (fromQuery) return { tenantId: fromQuery, source: 'query' };
  }

  const host = location.hostname.toLowerCase();
  const mapped = valid(options.hostMap[host]);
  if (mapped) return { tenantId: mapped, source: 'host-map' };

  if (options.strategy === 'subdomain' && options.baseDomain) {
    const base = options.baseDomain.toLowerCase().replace(/^\.+/, '');
    if (host.endsWith(`.${base}`)) {
      const label = host.slice(0, -(base.length + 1));
      // Only a single label is a tenant (no nested subdomains).
      const id = !label.includes('.') ? valid(label) : null;
      if (id) return { tenantId: id, source: 'subdomain' };
    }
  }

  if (options.strategy === 'path' || options.strategy === 'platform') {
    const segments = location.pathname.split('/').filter(Boolean);
    const prefix = options.pathPrefix.replace(/^\/+|\/+$/g, '');
    const idx = prefix ? (segments[0] === prefix ? 1 : -1) : 0;
    const id = idx >= 0 ? valid(segments[idx]) : null;
    if (id) return { tenantId: id, source: 'path' };
  }

  const fixed = valid(options.fixedTenantId);
  return fixed ? { tenantId: fixed, source: 'fixed' } : null;
}

/**
 * Platform strategy: dev override, build-time host map and /t/<id>/ paths are
 * checked locally; otherwise the backend is asked which café owns this host.
 * Other strategies resolve synchronously.
 */
export async function resolveTenantAsync(
  location: LocationLike,
  options: TenantResolverOptions,
  lookupHost: () => Promise<string | null>
): Promise<ResolvedTenant | null> {
  if (options.strategy !== 'platform') return resolveTenant(location, options);
  const local = resolveTenant(location, { ...options, fixedTenantId: null });
  if (local) return local;
  const fromHost = valid(await lookupHost());
  if (fromHost) return { tenantId: fromHost, source: 'platform-host' };
  const fixed = valid(options.fixedTenantId);
  return fixed ? { tenantId: fixed, source: 'fixed' } : null;
}

/** Parses VITE_TENANT_HOST_MAP; invalid JSON or entries are ignored. */
export function parseHostMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [host, id] of Object.entries(parsed as Record<string, unknown>)) {
      const tenant = typeof id === 'string' ? valid(id) : null;
      if (tenant && /^[a-z0-9.-]+$/i.test(host)) out[host.toLowerCase()] = tenant;
    }
    return out;
  } catch {
    return {};
  }
}
