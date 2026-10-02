// Production transport: JSON over HTTPS to the Café integration adapter/relay.
//
// The paths below are the website's expected contract (see
// docs/WEBSITE_INTEGRATION.md). The base URL comes from configuration; no
// production URL is hard-coded. No credentials are sent from the browser: the
// public surface must be safe without them, and any machine credential for Café
// lives in the relay, never here.

import type { SubmitOrderRequest } from '../types/order.ts';
import type { CafeTransport } from './transport.ts';
import { CafeIntegrationError, codeFromHttpStatus, normalizeWireErrorCode } from './errors.ts';

export interface HttpTransportOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export function createHttpTransport(options: HttpTransportOptions): CafeTransport {
  const base = options.baseUrl.replace(/\/+$/, '');
  const doFetch: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function request(path: string, init: RequestInit, outerSignal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    const onOuterAbort = () => controller.abort();
    outerSignal?.addEventListener('abort', onOuterAbort);

    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        ...init,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...(init.headers ?? {}) }
      });
    } catch {
      if (outerSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new CafeIntegrationError(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener('abort', onOuterAbort);
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const wire = typeof body === 'object' && body !== null ? (body as { error?: { code?: unknown } }).error?.code : undefined;
      const code = normalizeWireErrorCode(wire);
      throw new CafeIntegrationError(code === 'UNKNOWN' ? codeFromHttpStatus(response.status) : code, response.status);
    }
    if (body === null) throw new CafeIntegrationError('INVALID_RESPONSE', response.status);

    // Accept either a bare payload or Café's ApiResponse envelope { success, data }.
    if (typeof body === 'object' && 'success' in (body as object)) {
      const envelope = body as { success?: unknown; data?: unknown; error?: { code?: unknown } };
      if (envelope.success !== true) throw new CafeIntegrationError(normalizeWireErrorCode(envelope.error?.code));
      return envelope.data;
    }
    return body;
  }

  /** Every path is under the tenant, so the relay can enforce café isolation. */
  const tenantPath = (tenantId: string, path: string) => `/tenants/${encodeURIComponent(tenantId)}${path}`;

  return {
    kind: 'http',
    getTenantConfig: (tenantId, signal) => request(tenantPath(tenantId, '/config'), { method: 'GET' }, signal),
    getCatalog: (tenantId, signal) => request(tenantPath(tenantId, '/catalog'), { method: 'GET' }, signal),
    resolveTableToken: (tenantId, token, signal) =>
      request(
        tenantPath(tenantId, '/tables/resolve'),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) },
        signal
      ),
    submitOrder: (tenantId, req: SubmitOrderRequest, signal) =>
      request(
        tenantPath(tenantId, '/orders'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': req.clientRequestId },
          body: JSON.stringify(req)
        },
        signal
      ),
    getOrderStatus: (tenantId, publicReference, signal) =>
      request(tenantPath(tenantId, `/orders/${encodeURIComponent(publicReference)}`), { method: 'GET' }, signal)
  };
}

/** Used when no transport is configured: ordering is unavailable, never faked. */
export function createUnconfiguredTransport(): CafeTransport {
  const fail = async (): Promise<never> => {
    throw new CafeIntegrationError('NOT_CONFIGURED');
  };
  return {
    kind: 'unconfigured',
    getTenantConfig: fail,
    getCatalog: fail,
    resolveTableToken: fail,
    submitOrder: fail,
    getOrderStatus: fail
  };
}
