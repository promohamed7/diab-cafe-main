// Device-local list of orders this browser placed, so the customer can find
// them again. It holds Café's public tracking reference plus a snapshot of what
// the customer asked for (for display). Status always comes from Café.

import type { OrderType, PaymentMethod } from '../types/order';
import { readJson, writeJson } from './storage';

const KEY = 'inbyte_tracked_orders_v1';
const MAX_ORDERS = 10;

export interface TrackedOrderItem {
  name: string;
  quantity: number;
  options: string[];
}

export interface TrackedOrder {
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

const listeners = new Set<() => void>();
let cache: TrackedOrder[] | null = null;

function isTracked(v: unknown): v is TrackedOrder {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.publicReference === 'string' &&
    typeof o.orderNumber === 'string' &&
    typeof o.orderType === 'string' &&
    typeof o.acknowledgedTotalCents === 'number' &&
    Array.isArray(o.items)
  );
}

export function getTrackedOrders(): TrackedOrder[] {
  if (cache === null) {
    const raw = readJson(KEY);
    cache = Array.isArray(raw) ? raw.filter(isTracked).slice(0, MAX_ORDERS) : [];
  }
  return cache;
}

export function addTrackedOrder(order: TrackedOrder): void {
  const others = getTrackedOrders().filter((o) => o.publicReference !== order.publicReference);
  cache = [order, ...others].slice(0, MAX_ORDERS);
  writeJson(KEY, cache);
  listeners.forEach((l) => l());
}

export function subscribeTrackedOrders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
