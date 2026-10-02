// The single boundary between the website and whatever connects it to Café
// (relay, API adapter...). The UI and services never know which one is in use.
//
// Transports return raw wire data; services run it through the allow-list
// parsers in ./parsers.ts before anything reaches the UI.

import type { SubmitOrderRequest } from '../types/order.ts';

export type TransportKind = 'http' | 'mock' | 'unconfigured';

/**
 * Every call is scoped to exactly one tenant (café). The tenant is an explicit
 * argument — never ambient state — so a request can't silently go to the wrong
 * café. The integration side must enforce the same scope (a reference, table
 * token or idempotency key from one café is unknown to every other café).
 */
export interface CafeTransport {
  readonly kind: TransportKind;
  getTenantConfig(tenantId: string, signal?: AbortSignal): Promise<unknown>;
  getCatalog(tenantId: string, signal?: AbortSignal): Promise<unknown>;
  resolveTableToken(tenantId: string, token: string, signal?: AbortSignal): Promise<unknown>;
  submitOrder(tenantId: string, request: SubmitOrderRequest, signal?: AbortSignal): Promise<unknown>;
  getOrderStatus(tenantId: string, publicReference: string, signal?: AbortSignal): Promise<unknown>;
}
