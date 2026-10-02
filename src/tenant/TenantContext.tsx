import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TenantConfig } from '../types/tenant';
import type { TenantScope } from './tenantScope';
import { appConfig } from '../config/env';
import { resolveTenantAsync } from './tenantResolver';
import { browserAreas, createScopedStorage } from './scopedStorage';
import { isolateTenantSwitch } from './tenantSwitch';
import { TenantConfigError } from './parseTenantConfig';
import { sanitizeStoredAttempt } from '../domain/checkoutAttempt';
import { formatMoney } from '../domain/pricing';
import { getMockControls } from '../integration';
import { toCafeError } from '../integration/errors';
import { loadTenantConfig, lookupTenantForHost } from '../services/tenantConfigService';
import { purgeLegacyData } from '../services/storage';

// Resolves which café this visit belongs to, loads its configuration and
// provides it (plus a tenant-scoped storage) to the rest of the app. Nothing
// below this provider knows about any specific café.

interface TenantContextValue {
  tenant: TenantConfig;
  scope: TenantScope;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'unresolved' }
  | { status: 'not-found'; tenantId: string }
  | { status: 'error'; tenantId: string }
  | { status: 'ready'; tenant: TenantConfig; scope: TenantScope };

const TenantContext = createContext<TenantContextValue | null>(null);

function isUnresolvedAttempt(raw: unknown, tenantId: string): boolean {
  const a = sanitizeStoredAttempt(raw, tenantId);
  return a !== null && (a.status === 'OUTCOME_UNKNOWN' || a.status === 'PENDING_SEND');
}

/** Page-level metadata that differs per café (title, description, icon, theme colour, font). */
function applyDocumentMetadata(tenant: TenantConfig): void {
  const { identity, branding } = tenant;
  document.title = identity.tagline ? `${identity.displayName} — ${identity.tagline}` : identity.displayName;
  document.documentElement.lang = tenant.locale.split('-')[0] || 'ar';

  const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string | null) => {
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!content) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = content;
  };
  setMeta('meta[name="description"]', 'name', 'description', identity.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', identity.displayName);
  setMeta('meta[property="og:description"]', 'property', 'og:description', identity.description);
  const themeColor = branding.surfaces?.dark?.background;
  if (themeColor) setMeta('meta[name="theme-color"]', 'name', 'theme-color', themeColor);

  const icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (identity.faviconUrl) {
    const link = icon ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
    link.href = identity.faviconUrl;
  } else {
    icon?.remove();
  }

  if (branding.fontStylesheetUrl && !document.head.querySelector(`link[data-tenant-font]`)) {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = branding.fontStylesheetUrl;
    font.dataset.tenantFont = 'true';
    document.head.appendChild(font);
  }
}

const TenantScreen: React.FC<{
  state: 'loading' | 'not-found' | 'error';
  icon: string;
  title: string;
  text: string;
  onRetry?: () => void;
}> = ({ state, icon, title, text, onRetry }) => (
  <main className="tenant-screen" data-state={state} role={state === 'loading' ? 'status' : 'alert'}>
    <span className="material-symbols-outlined tenant-screen-icon" aria-hidden="true">{icon}</span>
    <h1>{title}</h1>
    <p>{text}</p>
    {onRetry && (
      <button type="button" className="btn-primary" onClick={onRetry}>
        إعادة المحاولة
      </button>
    )}
  </main>
);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    purgeLegacyData();
    let active = true;
    let tenantId = '';
    setState({ status: 'loading' });
    resolveTenantAsync(window.location, appConfig.tenant, () => lookupTenantForHost())
      .then((resolved) => {
        if (!active) return null;
        if (!resolved) {
          setState({ status: 'unresolved' });
          return null;
        }
        tenantId = resolved.tenantId;
        bindDevHooks(tenantId);
        return loadTenantConfig(tenantId);
      })
      .then((tenant) => {
        if (!active || !tenant) return;
        const areas = browserAreas();
        const scope: TenantScope = { tenantId, storage: createScopedStorage(tenantId, areas) };
        // Only once the café is confirmed: leaving another café on this origin drops
        // its cart, table and settled checkout (a mistyped URL must not clear them).
        isolateTenantSwitch(tenantId, areas, isUnresolvedAttempt);
        applyDocumentMetadata(tenant);
        setState({ status: 'ready', tenant, scope });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const notFound =
          (error instanceof TenantConfigError && error.code === 'TENANT_MISMATCH') ||
          toCafeError(error).code === 'TENANT_NOT_FOUND';
        setState(notFound ? { status: 'not-found', tenantId } : { status: 'error', tenantId });
      });

    // Development mock only: console hooks bound to this tenant. The condition is a
    // build-time constant, so production bundles don't contain this code at all.
    function bindDevHooks(tenantId: string): void {
      const mockBuild =
        import.meta.env.VITE_CAFE_TRANSPORT === 'mock' ||
        (import.meta.env.DEV && import.meta.env.VITE_CAFE_TRANSPORT !== 'http');
      if (mockBuild) void getMockControls().then((controls) => {
        if (!active || !controls) return;
        const bind = (id: string): Record<string, unknown> => {
          const out: Record<string, unknown> = { tenantId: id };
          for (const [name, fn] of Object.entries(controls)) {
            out[name] =
              name === 'tenantIds' || name === 'reset'
                ? fn
                : (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(id, ...args);
          }
          return out;
        };
        (window as unknown as { __INBYTE_DEV_MOCK__?: unknown }).__INBYTE_DEV_MOCK__ = { ...bind(tenantId), forTenant: bind };
      });
    }

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (state.status === 'loading') {
    return <TenantScreen state="loading" icon="progress_activity" title="جارٍ التحميل..." text="نجهز لك المنيو." />;
  }
  if (state.status === 'unresolved' || state.status === 'not-found') {
    return (
      <TenantScreen
        state="not-found"
        icon="storefront"
        title="المقهى غير موجود"
        text="لم نتمكن من التعرف على المقهى من هذا الرابط. تأكد من الرابط أو امسح كود QR مرة أخرى."
      />
    );
  }
  if (state.status === 'error') {
    return <TenantScreen state="error" icon="cloud_off" title="تعذر تحميل بيانات المقهى" text="تحقق من اتصالك بالإنترنت ثم أعد المحاولة." onRetry={retry} />;
  }

  return (
    <TenantContext.Provider value={{ tenant: state.tenant, scope: state.scope }}>
      {/* Keyed by tenant: nothing from one café's React state can survive into another's. */}
      <React.Fragment key={state.tenant.tenantId}>{children}</React.Fragment>
    </TenantContext.Provider>
  );
};

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

/** Money formatter using the current café's currency. Display only. */
export function useMoney(): (cents: number | null | undefined) => string {
  const { tenant } = useTenant();
  return useMemo(() => (cents) => formatMoney(cents, tenant.currency.symbol), [tenant.currency.symbol]);
}
