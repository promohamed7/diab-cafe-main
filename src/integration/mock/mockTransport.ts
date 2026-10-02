// DEVELOPMENT MOCK TRANSPORT — NOT THE PRODUCTION CONTRACT.
//
// Simulates the behaviour the website expects from a hardened Café integration
// so the customer journeys can be built and tested before the real adapter
// exists. It runs in the browser and persists to localStorage. Orders placed
// here never reach a café.
//
// It deliberately behaves like the *target* Café behaviour (scoped idempotency,
// required/single-select modifier enforcement, online-flag enforcement, no PII on
// replay). Today's Café does not do all of this yet; see docs/WEBSITE_INTEGRATION.md.

import type { CafeOrderStatus, SubmitOrderRequest } from '../../types/order.ts';
import type { CafeTransport } from '../transport.ts';
import { CafeIntegrationError } from '../errors.ts';
import { parseCatalog } from '../parsers.ts';
import { buildCatalogIndex } from '../../domain/catalogIndex.ts';
import { validateModifierSelection } from '../../domain/modifiers.ts';
import { estimateUnitCents } from '../../domain/pricing.ts';
import { canonicalJson } from '../../domain/checkoutAttempt.ts';
import { MAX_QUANTITY_PER_LINE } from '../../domain/cart.ts';
import { buildMockCatalog, MOCK_TABLES } from './mockCatalog.ts';
import type { WireCatalog } from './mockCatalog.ts';

export interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type MockFault = 'NETWORK_ERROR' | 'TIMEOUT_AFTER_COMMIT' | 'SERVICE_UNAVAILABLE';

interface MockOrder {
  publicReference: string;
  orderNumber: string;
  orderType: SubmitOrderRequest['orderType'];
  orderStatus: CafeOrderStatus;
  paymentStatus: 'PENDING';
  subtotalCents: number;
  totalCents: number;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockState {
  seq: number;
  orders: Record<string, MockOrder>;
  idempotency: Record<string, { fingerprint: string; publicReference: string }>;
  receivedRequestIds: string[];
  priceDriftCents: number;
  availability: Record<number, 'AVAILABLE' | 'UNAVAILABLE'>;
  pendingFault: MockFault | null;
}

export interface MockControls {
  /** Make the next order submission fail in the given way. */
  failNextSubmit(fault: MockFault): void;
  /** Simulate staff moving an order (what Café staff do in the POS). */
  setOrderStatus(publicReference: string, status: CafeOrderStatus, rejectionReason?: string): void;
  /** Simulate Café changing every menu price by `cents`. */
  setPriceDrift(cents: number): void;
  setProductAvailability(productId: number, availability: 'AVAILABLE' | 'UNAVAILABLE'): void;
  /** Every clientRequestId the mock received, oldest first. */
  receivedRequestIds(): string[];
  listOrders(): MockOrder[];
  tableTokens(): string[];
  reset(): void;
}

export interface MockTransport extends CafeTransport {
  readonly controls: MockControls;
}

const STATE_KEY = 'inbyte_dev_mock_state_v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function memoryStorage(): MockStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k)
  };
}

function freshState(): MockState {
  return {
    seq: 0,
    orders: {},
    idempotency: {},
    receivedRequestIds: [],
    priceDriftCents: 0,
    availability: {},
    pendingFault: null
  };
}

function randomHex(bytes: number): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function fail(code: ConstructorParameters<typeof CafeIntegrationError>[0]): never {
  throw new CafeIntegrationError(code);
}

export function createMockTransport(opts: { storage?: MockStorage; latencyMs?: number } = {}): MockTransport {
  const storage = opts.storage ?? memoryStorage();
  const latencyMs = opts.latencyMs ?? 0;

  const load = (): MockState => {
    try {
      const raw = storage.getItem(STATE_KEY);
      return raw ? { ...freshState(), ...(JSON.parse(raw) as MockState) } : freshState();
    } catch {
      return freshState();
    }
  };
  const save = (s: MockState) => {
    try {
      storage.setItem(STATE_KEY, JSON.stringify(s));
    } catch {
      // Storage full or unavailable: the mock keeps working for this page load.
    }
  };

  const delay = () => (latencyMs > 0 ? new Promise<void>((r) => setTimeout(r, latencyMs)) : Promise.resolve());

  const wireCatalog = (s: MockState): WireCatalog =>
    buildMockCatalog({ priceDriftCents: s.priceDriftCents, availability: s.availability });

  const ack = (o: MockOrder, replayed: boolean) => ({
    publicReference: o.publicReference,
    orderNumber: o.orderNumber,
    orderStatus: o.orderStatus,
    paymentStatus: o.paymentStatus,
    subtotalCents: o.subtotalCents,
    discountCents: 0,
    totalCents: o.totalCents,
    createdAt: o.createdAt,
    replayed
  });

  function validateAndPrice(s: MockState, req: SubmitOrderRequest): number {
    const { orderType, orderChannel } = req;
    if (orderChannel === 'ONLINE') {
      if (orderType !== 'PICKUP' && orderType !== 'DELIVERY') fail('VALIDATION_FAILED');
      if (req.tableToken !== undefined) fail('VALIDATION_FAILED');
    } else if (orderChannel === 'TABLE_QR') {
      if (orderType !== 'DINE_IN') fail('VALIDATION_FAILED');
      if (!req.tableToken || !MOCK_TABLES[req.tableToken]) fail('INVALID_TABLE_TOKEN');
    } else {
      fail('VALIDATION_FAILED');
    }

    const c = req.customerInfo ?? {};
    if (orderType !== 'DINE_IN' && (!c.fullName || !c.phone)) fail('CUSTOMER_DATA_REQUIRED');
    if (orderType === 'DELIVERY' && !c.deliveryAddress) fail('CUSTOMER_DATA_REQUIRED');
    if (orderType !== 'DELIVERY' && c.deliveryAddress !== undefined) fail('VALIDATION_FAILED');
    if (req.paymentMethod !== 'CASH' && req.paymentMethod !== 'CREDIT_CARD') fail('VALIDATION_FAILED');
    if (!Array.isArray(req.items) || req.items.length === 0) fail('VALIDATION_FAILED');

    const index = buildCatalogIndex(parseCatalog(wireCatalog(s)));
    const raw = wireCatalog(s);
    let total = 0;
    for (const item of req.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_LINE) {
        fail('VALIDATION_FAILED');
      }
      const product = index.productsById.get(item.productId);
      if (!product) {
        const exists = raw.products.some((p) => p.id === item.productId);
        fail(exists ? 'PRODUCT_UNAVAILABLE' : 'PRODUCT_INACTIVE');
      }
      if (product.availability === 'UNAVAILABLE') fail('INSUFFICIENT_STOCK');
      if (validateModifierSelection(product, item.modifierOptionIds ?? []).length > 0) fail('INVALID_MODIFIER_OPTION');
      total += estimateUnitCents(product, item.modifierOptionIds ?? []) * item.quantity;
    }
    if (req.expectedTotalCents !== undefined && req.expectedTotalCents !== total) fail('PRICE_TAMPERED_MISMATCH');
    return total;
  }

  const transport: MockTransport = {
    kind: 'mock',

    async getCatalog() {
      await delay();
      return wireCatalog(load());
    },

    async resolveTableToken(token: string) {
      await delay();
      const label = MOCK_TABLES[token];
      if (!label) fail('INVALID_TABLE_TOKEN');
      return { tableLabel: label };
    },

    async submitOrder(req: SubmitOrderRequest) {
      await delay();
      const s = load();

      const fault = s.pendingFault;
      if (fault) {
        s.pendingFault = null;
        save(s);
      }
      if (fault === 'NETWORK_ERROR') fail('NETWORK_ERROR');
      if (fault === 'SERVICE_UNAVAILABLE') fail('SERVICE_UNAVAILABLE');

      if (typeof req.clientRequestId !== 'string' || !UUID_RE.test(req.clientRequestId)) fail('VALIDATION_FAILED');
      s.receivedRequestIds = [...s.receivedRequestIds, req.clientRequestId].slice(-100);
      save(s);

      const { clientRequestId, ...rest } = req;
      const fingerprint = canonicalJson(rest);
      const previous = s.idempotency[clientRequestId];
      if (previous) {
        if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_KEY_CONFLICT');
        const original = s.orders[previous.publicReference];
        if (fault === 'TIMEOUT_AFTER_COMMIT') fail('TIMEOUT');
        return ack(original, true);
      }

      const total = validateAndPrice(s, req);
      const now = new Date().toISOString();
      const order: MockOrder = {
        publicReference: `ord_${randomHex(16)}`,
        orderNumber: `ORD-${1001 + s.seq}`,
        orderType: req.orderType,
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        subtotalCents: total,
        totalCents: total,
        rejectionReason: null,
        createdAt: now,
        updatedAt: now
      };
      s.seq += 1;
      s.orders[order.publicReference] = order;
      s.idempotency[clientRequestId] = { fingerprint, publicReference: order.publicReference };
      save(s);

      // Simulates "Café stored the order but the response never arrived".
      if (fault === 'TIMEOUT_AFTER_COMMIT') fail('TIMEOUT');
      return ack(order, false);
    },

    async getOrderStatus(publicReference: string) {
      await delay();
      const o = load().orders[publicReference];
      if (!o) fail('ORDER_NOT_FOUND');
      return {
        publicReference: o.publicReference,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        totalCents: o.totalCents,
        rejectionReason: o.rejectionReason,
        updatedAt: o.updatedAt
      };
    },

    controls: {
      failNextSubmit(fault) {
        const s = load();
        s.pendingFault = fault;
        save(s);
      },
      setOrderStatus(publicReference, status, rejectionReason) {
        const s = load();
        const o = s.orders[publicReference];
        if (!o) return;
        o.orderStatus = status;
        o.rejectionReason = status === 'REJECTED' ? rejectionReason ?? 'نفد أحد الأصناف' : null;
        o.updatedAt = new Date().toISOString();
        save(s);
      },
      setPriceDrift(cents) {
        const s = load();
        s.priceDriftCents = Math.trunc(cents);
        save(s);
      },
      setProductAvailability(productId, availability) {
        const s = load();
        s.availability = { ...s.availability, [productId]: availability };
        save(s);
      },
      receivedRequestIds: () => [...load().receivedRequestIds],
      listOrders: () => Object.values(load().orders),
      tableTokens: () => Object.keys(MOCK_TABLES),
      reset() {
        storage.removeItem(STATE_KEY);
      }
    }
  };
  return transport;
}
