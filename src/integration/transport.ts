// The single boundary between the website and whatever connects it to Café
// (relay, API adapter...). The UI and services never know which one is in use.
//
// Transports return raw wire data; services run it through the allow-list
// parsers in ./parsers.ts before anything reaches the UI.

import type { SubmitOrderRequest } from '../types/order.ts';

export type TransportKind = 'http' | 'mock' | 'unconfigured';

export interface CafeTransport {
  readonly kind: TransportKind;
  getCatalog(signal?: AbortSignal): Promise<unknown>;
  resolveTableToken(token: string, signal?: AbortSignal): Promise<unknown>;
  submitOrder(request: SubmitOrderRequest, signal?: AbortSignal): Promise<unknown>;
  getOrderStatus(publicReference: string, signal?: AbortSignal): Promise<unknown>;
}
