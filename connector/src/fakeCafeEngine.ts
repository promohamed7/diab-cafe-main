// DEVELOPMENT/TEST STAND-IN for INBYTE Café's unified order engine.
//
// It mimics the Café behaviours the platform relies on — authoritative
// pricing, modifier and stock validation, idempotency on clientRequestId,
// sequential ORD-#### numbers, staff-driven status — so the platform can be
// tested end to end. It is never used by production code.

import type {
  CafeEngine,
  CafeOrderStatus,
  CafePaymentStatus,
  CatalogSnapshot,
  OrderResult,
  StatusUpdate,
  TableRecord,
  UnifiedOrderRequest
} from './protocol.ts';

/** Same shape as the website's development fixtures (src/integration/mock). */
export interface WireCatalogLike {
  categories: { id: number; name: string; sortOrder: number; isActive: boolean; isAvailableOnline: boolean }[];
  products: {
    id: number;
    categoryId: number;
    name: string;
    description: string | null;
    priceCents: number;
    isActive: boolean;
    isAvailableOnline: boolean;
    availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
    modifierGroups: { id: number; name: string; isRequired: boolean; allowMultiple: boolean; options: { id: number; name: string; priceDeltaCents: number }[] }[];
  }[];
  version?: string | null;
}

interface CafeOrder {
  orderNumber: string;
  request: UnifiedOrderRequest;
  status: CafeOrderStatus;
  paymentStatus: CafePaymentStatus;
  totalCents: number;
  version: number;
  result: OrderResult;
}

export class FakeCafeEngine implements CafeEngine {
  private catalog: WireCatalogLike;
  private readonly tableList: TableRecord[];
  private readonly byRequestId = new Map<string, CafeOrder>();
  private readonly byNumber = new Map<string, CafeOrder>();
  private sequence = 1000;
  /** Products whose stock ran out in the café (inventory is Café-only). */
  readonly outOfStock = new Set<number>();
  /** Orders created (to prove no duplicates). */
  createdCount = 0;

  constructor(catalog: WireCatalogLike, tables: Record<string, string>) {
    this.catalog = catalog;
    this.tableList = Object.entries(tables).map(([token, label], i) => ({ tableId: i + 1, label, qrToken: token, isActive: true }));
  }

  /** Café staff change a price in the POS (the website's estimate becomes stale). */
  setPrice(productId: number, priceCents: number): void {
    this.catalog = {
      ...this.catalog,
      products: this.catalog.products.map((p) => (p.id === productId ? { ...p, priceCents } : p))
    };
  }

  catalogSnapshot(): CatalogSnapshot {
    const groups = new Map<number, CatalogSnapshot['modifierGroups'][number]>();
    for (const p of this.catalog.products) {
      for (const g of p.modifierGroups) {
        if (!groups.has(g.id)) groups.set(g.id, { id: g.id, name: g.name, isRequired: g.isRequired, allowMultiple: g.allowMultiple, options: g.options.map((o, i) => ({ ...o, sortOrder: i })) });
      }
    }
    return {
      version: this.catalog.version ?? null,
      categories: this.catalog.categories,
      modifierGroups: [...groups.values()],
      products: this.catalog.products.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        isActive: p.isActive,
        isAvailableOnline: p.isAvailableOnline,
        availability: this.outOfStock.has(p.id) ? 'UNAVAILABLE' : p.availability,
        modifierGroupIds: p.modifierGroups.map((g) => g.id)
      }))
    };
  }

  tables(): TableRecord[] {
    return this.tableList;
  }

  createOrder(request: UnifiedOrderRequest): OrderResult {
    const existing = this.byRequestId.get(request.clientRequestId);
    if (existing) return existing.result; // idempotent replay

    const reject = (errorCode: string): OrderResult => ({ outcome: 'REJECTED', errorCode });
    if (request.orderType === 'DINE_IN') {
      const table = this.tableList.find((t) => t.qrToken === request.tableToken && t.tableId === request.tableId && t.isActive);
      if (!table) return reject('TableInactiveOrInvalid');
    }
    let total = 0;
    for (const item of request.items) {
      const product = this.catalog.products.find((p) => p.id === item.productId);
      if (!product || !product.isActive) return reject('ProductInactive');
      if (!product.isAvailableOnline) return reject('ProductNotAvailableOnline');
      if (this.outOfStock.has(product.id)) return reject('InsufficientStock');
      let unit = product.priceCents;
      for (const optionId of item.modifierOptionIds) {
        const option = product.modifierGroups.flatMap((g) => g.options).find((o) => o.id === optionId);
        if (!option) return reject('InvalidModifierOption');
        unit += option.priceDeltaCents;
      }
      total += unit * item.quantity;
    }
    if (request.expectedTotalCents !== total) return reject('PriceTamperedMismatch');

    this.sequence += 1;
    const orderNumber = `ORD-${this.sequence}`;
    const result: OrderResult = {
      outcome: 'CREATED',
      orderNumber,
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      subtotalCents: total,
      discountCents: 0,
      totalCents: total,
      statusVersion: 1
    };
    const order: CafeOrder = { orderNumber, request, status: 'PENDING', paymentStatus: 'PENDING', totalCents: total, version: 1, result };
    this.byRequestId.set(request.clientRequestId, order);
    this.byNumber.set(orderNumber, order);
    this.createdCount += 1;
    return result;
  }

  /** Staff action in the POS. Returns the status update the connector must forward. */
  staff(orderNumber: string, status: CafeOrderStatus, paymentStatus?: CafePaymentStatus, reason?: string): StatusUpdate {
    const order = this.byNumber.get(orderNumber);
    if (!order) throw new Error(`unknown order ${orderNumber}`);
    order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    order.version += 1;
    return { orderStatus: order.status, paymentStatus: order.paymentStatus, statusVersion: order.version, rejectionReason: reason ?? null };
  }
}
