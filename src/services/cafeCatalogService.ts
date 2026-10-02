// Catalog service: fetches Café's customer-facing projection and keeps a local
// display cache. The cache only makes the menu appear faster or survive a
// flaky connection; it is never used as pricing authority (Café re-prices and
// rejects stale totals at checkout).

import type { CafeCatalog } from '../types/catalog';
import { getCafeTransport } from '../integration';
import { parseCatalog } from '../integration/parsers';
import { readJson, writeJson } from './storage';

const CACHE_KEY = 'inbyte_catalog_cache_v1';
/** A cached menu older than this is not shown at all. */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CatalogResult {
  catalog: CafeCatalog;
  source: 'live' | 'cache';
  fetchedAt: number;
}

interface CacheEntry {
  fetchedAt: number;
  data: unknown;
}

export function readCachedCatalog(now = Date.now()): CatalogResult | null {
  const entry = readJson(CACHE_KEY) as CacheEntry | null;
  if (!entry || typeof entry.fetchedAt !== 'number' || now - entry.fetchedAt > CACHE_MAX_AGE_MS) return null;
  try {
    // The cached copy went through the allow-list parser before; parse again anyway.
    return { catalog: parseCatalog(entry.data), source: 'cache', fetchedAt: entry.fetchedAt };
  } catch {
    return null;
  }
}

export async function getCatalog(signal?: AbortSignal): Promise<CatalogResult> {
  const transport = await getCafeTransport();
  const raw = await transport.getCatalog(signal);
  const catalog = parseCatalog(raw);
  const fetchedAt = Date.now();
  // Store the parsed (allow-listed) form, never the raw response.
  writeJson(CACHE_KEY, { fetchedAt, data: catalog } satisfies CacheEntry);
  return { catalog, source: 'live', fetchedAt };
}
