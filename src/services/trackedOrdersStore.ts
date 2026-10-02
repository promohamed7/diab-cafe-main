// Device-local list of orders this browser placed at ONE café, so the customer
// can find them again. It holds the café's public tracking reference plus a
// snapshot of what the customer asked for (for display). Status always comes
// from the café. Each café has its own list; records carry their tenantId and
// any record for another tenant is ignored.

import type { OrderType, PaymentMethod } from '../types/order';
import type { TenantScope } from '../tenant/tenantScope';

const NAME = 'tracked_orders';
const MAX_ORDERS = 10;

export interface TrackedOrderItem {
  name: string;
  quantity: number;
  options: string[];
}

export interface TrackedOrder {
  tenantId: string;
  publicReference: string;
  orderNumber: string;
  orderType: OrderType;
  tableLabel: string | null;
  paymentMethod: PaymentMethod;
  /** Café's authoritative total at acknowledgement time. */
  acknowledgedTotalCents: number;
  placedAt: string;
  items: TrackedOrderItem[];
}

export interface TrackedOrdersStore {
  get(): TrackedOrder[];
  add(order: TrackedOrder): void;
  subscribe(listener: () => void): () => void;
}

function isTracked(v: unknown, tenantId: string): v is TrackedOrder {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.tenantId === tenantId &&
    typeof o.publicReference === 'string' &&
    typeof o.orderNumber === 'string' &&
    typeof o.orderType === 'string' &&
    typeof o.acknowledgedTotalCents === 'number' &&
    Array.isArray(o.items)
  );
}

const stores = new Map<string, TrackedOrdersStore>();

/** One store per tenant (stable identity, so React can subscribe to it). */
export function trackedOrdersStore(scope: TenantScope): TrackedOrdersStore {
  const existing = stores.get(scope.tenantId);
  if (existing) return existing;

  const listeners = new Set<() => void>();
  let cache: TrackedOrder[] | null = null;

  const store: TrackedOrdersStore = {
    get() {
      if (cache === null) {
        const raw = scope.storage.readJson(NAME);
        cache = Array.isArray(raw) ? raw.filter((o) => isTracked(o, scope.tenantId)).slice(0, MAX_ORDERS) : [];
      }
      return cache;
    },
    add(order) {
      if (order.tenantId !== scope.tenantId) return;
      cache = [order, ...store.get().filter((o) => o.publicReference !== order.publicReference)].slice(0, MAX_ORDERS);
      scope.storage.writeJson(NAME, cache);
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  stores.set(scope.tenantId, store);
  return store;
}
