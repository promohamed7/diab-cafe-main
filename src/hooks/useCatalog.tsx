import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogIndex } from '../domain/catalogIndex';
import { buildCatalogIndex } from '../domain/catalogIndex';
import type { CafeErrorCode } from '../integration/errors';
import { toCafeError } from '../integration/errors';
import { getCatalog, readCachedCatalog } from '../services/cafeCatalogService';
import { useTenant } from '../tenant/TenantContext';

export type CatalogStatus = 'loading' | 'ready' | 'error';

interface CatalogContextValue {
  status: CatalogStatus;
  index: CatalogIndex | null;
  /** 'cache' means the live Café menu could not be loaded; prices may be outdated. */
  source: 'live' | 'cache' | null;
  errorCode: CafeErrorCode | null;
  reload: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The catalog always belongs to the current café; its cache is stored in the café's own scope.
  const { scope } = useTenant();
  const [state, setState] = useState<Omit<CatalogContextValue, 'reload'>>(() => {
    const cached = readCachedCatalog(scope);
    return cached
      ? { status: 'ready', index: buildCatalogIndex(cached.catalog), source: 'cache', errorCode: null }
      : { status: 'loading', index: null, source: null, errorCode: null };
  });
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setState((s) => (s.index ? s : { ...s, status: 'loading', errorCode: null }));
    try {
      const result = await getCatalog(scope);
      if (seq !== requestSeq.current) return;
      setState({ status: 'ready', index: buildCatalogIndex(result.catalog), source: 'live', errorCode: null });
    } catch (error) {
      if (seq !== requestSeq.current) return;
      const code = toCafeError(error).code;
      // Keep showing a cached menu if there is one, but flag it as not live.
      setState((s) => (s.index ? { ...s, source: 'cache', errorCode: code } : { status: 'error', index: null, source: null, errorCode: code }));
    }
  }, [scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(() => ({ ...state, reload }), [state, reload]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
