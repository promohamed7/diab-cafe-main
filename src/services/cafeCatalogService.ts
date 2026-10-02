// Catalog service: fetches one café's customer-facing projection and keeps a
// per-café display cache. The cache only makes the menu appear faster or
// survive a flaky connection; it is never pricing authority (Café re-prices and
// rejects stale totals at checkout).

import type { CafeCatalog } from '../types/catalog';
import type { TenantScope } from '../tenant/tenantScope';
import { getCafeTransport } from '../integration';
import { assertTenantEcho, parseCatalog } from '../integration/parsers';

const CACHE_NAME = 'catalog_cache';
/** A cached menu older than this is not shown at all. */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CatalogResult {
  catalog: CafeCatalog;
  source: 'live' | 'cache';
  fetchedAt: number;
}

interface CacheEntry {
  tenantId: string;
  fetchedAt: number;
  data: unknown;
}

export function readCachedCatalog(scope: TenantScope, now = Date.now()): CatalogResult | null {
  const entry = scope.storage.readJson(CACHE_NAME) as CacheEntry | null;
  if (
    !entry ||
    entry.tenantId !== scope.tenantId ||
    typeof entry.fetchedAt !== 'number' ||
    now - entry.fetchedAt > CACHE_MAX_AGE_MS
  ) {
    return null;
  }
  try {
    return { catalog: parseCatalog(entry.data), source: 'cache', fetchedAt: entry.fetchedAt };
  } catch {
    return null;
  }
}

export async function getCatalog(scope: TenantScope, signal?: AbortSignal): Promise<CatalogResult> {
  const transport = await getCafeTransport();
  const raw = await transport.getCatalog(scope.tenantId, signal);
  assertTenantEcho(raw, scope.tenantId);
  const catalog = parseCatalog(raw);
  const fetchedAt = Date.now();
  // Store the parsed (allow-listed) form, never the raw response.
  scope.storage.writeJson(CACHE_NAME, { tenantId: scope.tenantId, fetchedAt, data: catalog } satisfies CacheEntry);
  return { catalog, source: 'live', fetchedAt };
}
