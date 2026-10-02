// Wire types of the café connector protocol (/api/integration/v1).
// See docs/INTEGRATION_WITH_INBYTE_CAFE.md for the normative description.

export type CafeOrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type CafePaymentStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFIED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface CatalogSnapshot {
  version: string | null;
  categories: { id: number; name: string; sortOrder: number; isActive: boolean; isAvailableOnline: boolean }[];
  modifierGroups: {
    id: number;
    name: string;
    isRequired: boolean;
    allowMultiple: boolean;
    options: { id: number; name: string; priceDeltaCents: number; sortOrder?: number }[];
  }[];
  products: {
    id: number;
    categoryId: number;
    name: string;
    description: string | null;
    priceCents: number;
    isActive: boolean;
    isAvailableOnline: boolean;
    availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
    modifierGroupIds: number[];
  }[];
}

export interface TableRecord {
  tableId: number;
  label: string;
  qrToken: string;
  isActive: boolean;
}

/** Shaped like INBYTE Café's CreateUnifiedOrderDto. */
export interface UnifiedOrderRequest {
  orderType: 'PICKUP' | 'DELIVERY' | 'DINE_IN';
  orderChannel: 'ONLINE' | 'TABLE_QR';
  tableId: number | null;
  tableToken: string | null;
  items: { productId: number; quantity: number; modifierOptionIds: number[] }[];
  customerInfo: { fullName: string | null; phone: string | null; deliveryAddress: string | null; customerNotes: string | null };
  paymentMethod: 'CASH' | 'CREDIT_CARD';
  expectedTotalCents: number;
  clientRequestId: string;
}

export interface LeasedOrder {
  publicReference: string;
  clientRequestId: string;
  attempt: number;
  leaseExpiresAt: string;
  createdAt: string;
  order: UnifiedOrderRequest;
}

export type OrderResult =
  | {
      outcome: 'CREATED';
      orderNumber: string;
      orderStatus: CafeOrderStatus;
      paymentStatus: CafePaymentStatus;
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      statusVersion: number;
    }
  | { outcome: 'REJECTED'; errorCode: string; customerMessage?: string | null };

export interface StatusUpdate {
  orderStatus: CafeOrderStatus;
  paymentStatus: CafePaymentStatus;
  statusVersion: number;
  rejectionReason?: string | null;
}

/** What the connector needs from INBYTE Café. The real implementation lives in Café (Rust). */
export interface CafeEngine {
  catalogSnapshot(): CatalogSnapshot;
  tables(): TableRecord[];
  /**
   * Must be idempotent on clientRequestId: the same request delivered twice
   * (lease expired, response lost) returns the original result.
   */
  createOrder(request: UnifiedOrderRequest): OrderResult;
}
