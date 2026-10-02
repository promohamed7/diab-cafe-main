// Reference implementation of the café side of the integration protocol.
//
// It documents (as running code) what the INBYTE Café connector must do, and
// drives the end-to-end tests. Production cafés run the equivalent inside
// INBYTE Café itself (Rust), talking to the real unified order engine.
//
// Outbound HTTPS only. The credential is the café's identity; it is stored by
// the caller (e.g. Café's secure settings), never logged.

import type { CafeEngine, LeasedOrder, OrderResult, StatusUpdate } from './protocol.ts';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

export class ConnectorError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

async function call(fetchImpl: FetchLike, url: string, method: string, body: unknown, credential?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (credential) headers.Authorization = `Bearer ${credential}`;
  const res = await fetchImpl(url, { method, headers, body: JSON.stringify(body ?? {}) });
  const json = (await res.json().catch(() => null)) as any;
  if (res.status >= 400) throw new ConnectorError(res.status, json?.error?.code ?? 'UNKNOWN');
  return json;
}

export interface ConnectorOptions {
  baseUrl: string;
  credential: string;
  engine: CafeEngine;
  fetchImpl?: FetchLike;
  connectorVersion?: string;
}

export class ReferenceConnector {
  private readonly base: string;
  private readonly credential: string;
  private readonly engine: CafeEngine;
  private readonly fetchImpl: FetchLike;
  private readonly version: string;

  constructor(options: ConnectorOptions) {
    this.base = `${options.baseUrl.replace(/\/+$/, '')}/api/integration/v1`;
    this.credential = options.credential;
    this.engine = options.engine;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.version = options.connectorVersion ?? 'reference-1.0';
  }

  /** One-time pairing with the code shown in the INBYTE Admin. Returns the credential to store. */
  static async pair(
    baseUrl: string,
    pairingCode: string,
    cafeInstanceId: string,
    fetchImpl: FetchLike = (url, init) => fetch(url, init)
  ): Promise<{ tenantId: string; credential: string }> {
    return call(fetchImpl, `${baseUrl.replace(/\/+$/, '')}/api/integration/v1/pair`, 'POST', {
      pairingCode,
      cafeInstanceId,
      connectorVersion: 'reference-1.0'
    });
  }

  heartbeat(): Promise<{ serverTime: string; tenantId: string; pendingOrders: number }> {
    return call(this.fetchImpl, `${this.base}/heartbeat`, 'POST', { connectorVersion: this.version }, this.credential);
  }

  syncCatalog() {
    return call(this.fetchImpl, `${this.base}/catalog`, 'PUT', this.engine.catalogSnapshot(), this.credential);
  }

  syncTables() {
    return call(this.fetchImpl, `${this.base}/tables`, 'PUT', { tables: this.engine.tables() }, this.credential);
  }

  /**
   * Leases queued orders, creates each in Café and reports the outcome.
   * If reporting fails, the lease expires and the order comes back with the
   * same clientRequestId; Café's idempotency then returns the same result.
   */
  async processOrders(max = 10): Promise<{ publicReference: string; result: OrderResult }[]> {
    const { orders } = (await call(this.fetchImpl, `${this.base}/orders/lease`, 'POST', { max }, this.credential)) as { orders: LeasedOrder[] };
    const done: { publicReference: string; result: OrderResult }[] = [];
    for (const leased of orders) {
      const result = this.engine.createOrder({ ...leased.order, clientRequestId: leased.clientRequestId });
      await this.reportResult(leased.publicReference, result);
      done.push({ publicReference: leased.publicReference, result });
    }
    return done;
  }

  reportResult(publicReference: string, result: OrderResult) {
    return call(this.fetchImpl, `${this.base}/orders/${encodeURIComponent(publicReference)}/result`, 'POST', result, this.credential);
  }

  reportStatus(publicReference: string, update: StatusUpdate) {
    return call(this.fetchImpl, `${this.base}/orders/${encodeURIComponent(publicReference)}/status`, 'POST', update, this.credential);
  }

  /** Heartbeat + process. A real connector runs this every few seconds and syncs the catalog on change. */
  async tick(): Promise<void> {
    const hb = await this.heartbeat();
    if (hb.pendingOrders > 0) await this.processOrders();
  }
}
