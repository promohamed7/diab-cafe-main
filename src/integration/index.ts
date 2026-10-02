// Selects the transport once per page load.
//
// - `http`: production. Requires VITE_CAFE_API_BASE_URL; without it every call
//   fails with NOT_CONFIGURED and the UI says online ordering is unavailable.
// - `mock`: development only. Loaded lazily so production bundles don't depend
//   on it, and clearly flagged in the UI.

import { appConfig } from '../config/env';
import type { CafeTransport } from './transport.ts';
import { createHttpTransport, createUnconfiguredTransport } from './httpTransport.ts';

let transportPromise: Promise<CafeTransport> | null = null;

async function createTransport(): Promise<CafeTransport> {
  // Written as a build-time constant expression so production `http` builds can
  // drop the mock module entirely instead of shipping it as an unused chunk.
  const mockSelected =
    import.meta.env.VITE_CAFE_TRANSPORT === 'mock' ||
    (import.meta.env.DEV && import.meta.env.VITE_CAFE_TRANSPORT !== 'http');
  if (mockSelected) {
    const { createMockTransport } = await import('./mock/mockTransport.ts');
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    const transport = createMockTransport({ storage, latencyMs: 450 });
    if (typeof window !== 'undefined') {
      // Dev-only console hooks for testing: simulate staff actions and failures.
      (window as unknown as { __INBYTE_DEV_MOCK__?: unknown }).__INBYTE_DEV_MOCK__ = transport.controls;
    }
    return transport;
  }
  if (!appConfig.apiBaseUrl) return createUnconfiguredTransport();
  return createHttpTransport({ baseUrl: appConfig.apiBaseUrl, timeoutMs: appConfig.apiTimeoutMs });
}

export function getCafeTransport(): Promise<CafeTransport> {
  transportPromise ??= createTransport();
  return transportPromise;
}

export function getTransportKind(): Promise<CafeTransport['kind']> {
  return getCafeTransport().then((t) => t.kind);
}
