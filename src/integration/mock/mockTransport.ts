// DEVELOPMENT MOCK TRANSPORT — NOT THE PRODUCTION CONTRACT.
//
// Simulates the behaviour the website expects from a hardened, multi-tenant
// Café integration so the customer journeys can be built and tested before the
// real adapter exists. It runs in the browser and persists to localStorage.
// Orders placed here never reach a café.
//
// Every tenant (café) has completely separate state: catalog overrides,
// orders, idempotency keys, tables. A reference, table token or clientRequestId
// from one tenant is unknown to every other tenant — the isolation the real
// integration must also enforce. Today's Café does not do all of this yet; see
// docs/WEBSITE_INTEGRATION.md and docs/WHITE_LABEL_ARCHITECTURE.md.

import type { CafeOrderStatus, SubmitOrderRequest } from '../../types/order.ts';
import type { CafeTransport } from '../transport.ts';
import { CafeIntegrationError } from '../errors.ts';
import { parseCatalog } from '../parsers.ts';
import { buildCatalogIndex } from '../../domain/catalogIndex.ts';
import { validateModifierSelection } from '../../domain/modifiers.ts';
import { estimateUnitCents } from '../../domain/pricing.ts';
import { canonicalJson } from '../../domain/checkoutAttempt.ts';
import { MAX_QUANTITY_PER_LINE } from '../../domain/cart.ts';
import type { MockTenantFixture } from './mockTenants.ts';
import { MOCK_TENANTS } from './mockTenants.ts';
import type { WireCatalog } from './mockCatalog.ts';

export interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type MockFault = 'NETWORK_ERROR' | 'TIMEOUT_AFTER_COMMIT' | 'SERVICE_UNAVAILABLE';

interface MockOrder {
  tenantId: string;
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

interface TenantState {
  seq: number;
  orders: Record<string, MockOrder>;
  idempotency: Record<string, { fingerprint: string; publicReference: string }>;
  receivedRequestIds: string[];
  priceDriftCents: number;
  availability: Record<number, 'AVAILABLE' | 'UNAVAILABLE'>;
  pendingFault: MockFault | null;
}

interface MockState {
  tenants: Record<string, TenantState>;
}

/** Dev controls. Every function is scoped to one tenant, like the real integration. */
export interface MockControls {
  /** Make the next order submission for the tenant fail in the given way. */
  failNextSubmit(tenantId: string, fault: MockFault): void;
  /** Simulate staff moving an order (what Café staff do in the POS). */
  setOrderStatus(tenantId: string, publicReference: string, status: CafeOrderStatus, rejectionReason?: string): void;
  /** Simulate the café changing every menu price by `cents`. */
  setPriceDrift(tenantId: string, cents: number): void;
  setProductAvailability(tenantId: string, productId: number, availability: 'AVAILABLE' | 'UNAVAILABLE'): void;
  /** Every clientRequestId the tenant received, oldest first. */
  receivedRequestIds(tenantId: string): string[];
  listOrders(tenantId: string): MockOrder[];
  tableTokens(tenantId: string): string[];
  tenantIds(): string[];
  reset(): void;
}

export interface MockTransport extends CafeTransport {
  readonly controls: MockControls;
}

const STATE_KEY = 'inbyte_dev_mock_state_v2';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function memoryStorage(): MockStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k)
  };
}

function freshTenantState(): TenantState {
  return { seq: 0, orders: {}, idempotency: {}, receivedRequestIds: [], priceDriftCents: 0, availability: {}, pendingFault: null };
}

function randomHex(bytes: number): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function fail(code: ConstructorParameters<typeof CafeIntegrationError>[0]): never {
  throw new CafeIntegrationError(code);
}

export function createMockTransport(
  opts: { storage?: MockStorage; latencyMs?: number; tenants?: Record<string, MockTenantFixture> } = {}
): MockTransport {
  const storage = opts.storage ?? memoryStorage();
  const latencyMs = opts.latencyMs ?? 0;
  const fixtures = opts.tenants ?? MOCK_TENANTS;

  const load = (): MockState => {
    try {
      const raw = storage.getItem(STATE_KEY);
      const parsed = raw ? (JSON.parse(raw) as MockState) : null;
      return parsed && typeof parsed.tenants === 'object' ? parsed : { tenants: {} };
    } catch {
      return { tenants: {} };
    }
  };
  const save = (s: MockState) => {
    try {
      storage.setItem(STATE_KEY, JSON.stringify(s));
    } catch {
      // Storage full or unavailable: the mock keeps working for this page load.
    }
  };

  /** Loads the whole state plus the tenant's own slice; unknown tenants don't exist. */
  const tenantState = (tenantId: string): { state: MockState; t: TenantState; fixture: MockTenantFixture } => {
    const fixture = Object.prototype.hasOwnProperty.call(fixtures, tenantId) ? fixtures[tenantId] : undefined;
    if (!fixture) fail('TENANT_NOT_FOUND');
    const state = load();
    const t = { ...freshTenantState(), ...(state.tenants[tenantId] ?? {}) };
    state.tenants[tenantId] = t;
    return { state, t, fixture };
  };

  const delay = () => (latencyMs > 0 ? new Promise<void>((r) => setTimeout(r, latencyMs)) : Promise.resolve());

  const wireCatalog = (fixture: MockTenantFixture, t: TenantState): WireCatalog =>
    fixture.buildCatalog({ priceDriftCents: t.priceDriftCents, availability: t.availability });

  const ack = (o: MockOrder, replayed: boolean) => ({
    tenantId: o.tenantId,
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

  function validateAndPrice(fixture: MockTenantFixture, t: TenantState, req: SubmitOrderRequest): number {
    const { orderType, orderChannel } = req;
    if (orderChannel === 'ONLINE') {
      if (orderType !== 'PICKUP' && orderType !== 'DELIVERY') fail('VALIDATION_FAILED');
      if (req.tableToken !== undefined) fail('VALIDATION_FAILED');
    } else if (orderChannel === 'TABLE_QR') {
      if (orderType !== 'DINE_IN') fail('VALIDATION_FAILED');
      // Only this tenant's own tokens are valid.
      if (!req.tableToken || !Object.prototype.hasOwnProperty.call(fixture.tables, req.tableToken)) fail('INVALID_TABLE_TOKEN');
    } else {
      fail('VALIDATION_FAILED');
    }

    const c = req.customerInfo ?? {};
    if (orderType !== 'DINE_IN' && (!c.fullName || !c.phone)) fail('CUSTOMER_DATA_REQUIRED');
    if (orderType === 'DELIVERY' && !c.deliveryAddress) fail('CUSTOMER_DATA_REQUIRED');
    if (orderType !== 'DELIVERY' && c.deliveryAddress !== undefined) fail('VALIDATION_FAILED');
    if (req.paymentMethod !== 'CASH' && req.paymentMethod !== 'CREDIT_CARD') fail('VALIDATION_FAILED');
    if (!Array.isArray(req.items) || req.items.length === 0) fail('VALIDATION_FAILED');

    const raw = wireCatalog(fixture, t);
    const index = buildCatalogIndex(parseCatalog(raw));
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

  const update = (tenantId: string, fn: (t: TenantState) => void) => {
    const { state, t } = tenantState(tenantId);
    fn(t);
    save(state);
  };

  const transport: MockTransport = {
    kind: 'mock',

    async getTenantConfig(tenantId: string) {
      await delay();
      return tenantState(tenantId).fixture.config;
    },

    async getCatalog(tenantId: string) {
      await delay();
      const { t, fixture } = tenantState(tenantId);
      return { tenantId, ...wireCatalog(fixture, t) };
    },

    async resolveTableToken(tenantId: string, token: string) {
      await delay();
      const { fixture } = tenantState(tenantId);
      if (!Object.prototype.hasOwnProperty.call(fixture.tables, token)) fail('INVALID_TABLE_TOKEN');
      return { tenantId, tableLabel: fixture.tables[token] };
    },

    async submitOrder(tenantId: string, req: SubmitOrderRequest) {
      await delay();
      const { state, t, fixture } = tenantState(tenantId);

      const fault = t.pendingFault;
      if (fault) {
        t.pendingFault = null;
        save(state);
      }
      if (fault === 'NETWORK_ERROR') fail('NETWORK_ERROR');
      if (fault === 'SERVICE_UNAVAILABLE') fail('SERVICE_UNAVAILABLE');

      if (typeof req.clientRequestId !== 'string' || !UUID_RE.test(req.clientRequestId)) fail('VALIDATION_FAILED');
      t.receivedRequestIds = [...t.receivedRequestIds, req.clientRequestId].slice(-100);
      save(state);

      // Idempotency keys are scoped to the tenant: the same key at another café is a different request.
      const { clientRequestId, ...rest } = req;
      const fingerprint = canonicalJson(rest);
      const previous = t.idempotency[clientRequestId];
      if (previous) {
        if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_KEY_CONFLICT');
        const original = t.orders[previous.publicReference];
        if (fault === 'TIMEOUT_AFTER_COMMIT') fail('TIMEOUT');
        return ack(original, true);
      }

      const total = validateAndPrice(fixture, t, req);
      const now = new Date().toISOString();
      const order: MockOrder = {
        tenantId,
        publicReference: `ord_${randomHex(16)}`,
        orderNumber: `ORD-${1001 + t.seq}`,
        orderType: req.orderType,
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        subtotalCents: total,
        totalCents: total,
        rejectionReason: null,
        createdAt: now,
        updatedAt: now
      };
      t.seq += 1;
      t.orders[order.publicReference] = order;
      t.idempotency[clientRequestId] = { fingerprint, publicReference: order.publicReference };
      save(state);

      // Simulates "the café stored the order but the response never arrived".
      if (fault === 'TIMEOUT_AFTER_COMMIT') fail('TIMEOUT');
      return ack(order, false);
    },

    async getOrderStatus(tenantId: string, publicReference: string) {
      await delay();
      const { t } = tenantState(tenantId);
      // References are only looked up within the requesting tenant.
      const o = Object.prototype.hasOwnProperty.call(t.orders, publicReference) ? t.orders[publicReference] : undefined;
      if (!o) fail('ORDER_NOT_FOUND');
      return {
        tenantId,
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
      failNextSubmit: (tenantId, fault) => update(tenantId, (t) => (t.pendingFault = fault)),
      setOrderStatus: (tenantId, publicReference, status, rejectionReason) =>
        update(tenantId, (t) => {
          const o = t.orders[publicReference];
          if (!o) return;
          o.orderStatus = status;
          o.rejectionReason = status === 'REJECTED' ? rejectionReason ?? 'نفد أحد الأصناف' : null;
          o.updatedAt = new Date().toISOString();
        }),
      setPriceDrift: (tenantId, cents) => update(tenantId, (t) => (t.priceDriftCents = Math.trunc(cents))),
      setProductAvailability: (tenantId, productId, availability) =>
        update(tenantId, (t) => (t.availability = { ...t.availability, [productId]: availability })),
      receivedRequestIds: (tenantId) => [...tenantState(tenantId).t.receivedRequestIds],
      listOrders: (tenantId) => Object.values(tenantState(tenantId).t.orders),
      tableTokens: (tenantId) => Object.keys(tenantState(tenantId).fixture.tables),
      tenantIds: () => Object.keys(fixtures),
      reset: () => storage.removeItem(STATE_KEY)
    }
  };
  return transport;
}
