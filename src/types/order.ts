import type { CafeId } from './catalog.ts';

// Order request / response shapes exchanged with the Café integration layer.
// Field names follow Café's CreateUnifiedOrderDto (camelCase).

export type OrderChannel = 'ONLINE' | 'TABLE_QR';

/** ONLINE allows PICKUP or DELIVERY. DINE_IN exists only on the TABLE_QR channel. */
export type OrderType = 'PICKUP' | 'DELIVERY' | 'DINE_IN';

/** Outside-the-café order types a normal visitor can choose. */
export type OutsideOrderType = 'PICKUP' | 'DELIVERY';

/**
 * MVP subset of Café's PaymentMethod enum. Both are settled with staff at
 * handover; the website never marks anything as paid.
 */
export type PaymentMethod = 'CASH' | 'CREDIT_CARD';

export type CafeOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type CafePaymentStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFIED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface OrderLineRequest {
  productId: CafeId;
  quantity: number;
  modifierOptionIds: CafeId[];
}

export interface CustomerInfoRequest {
  fullName?: string;
  phone?: string;
  /** DELIVERY only. */
  deliveryAddress?: string;
  customerNotes?: string;
}

/**
 * Everything the website is allowed to send. There is deliberately no place for
 * prices, discounts, statuses, order numbers, cashier or shift fields.
 */
export interface SubmitOrderRequest {
  orderType: OrderType;
  orderChannel: OrderChannel;
  items: OrderLineRequest[];
  customerInfo: CustomerInfoRequest;
  /** TABLE_QR / DINE_IN only. Exactly the token from the Café QR URL. */
  tableToken?: string;
  paymentMethod: PaymentMethod;
  /** Reserved for future transfer methods. Not sent in the MVP. */
  paymentReference?: string;
  /** Client expectation only. Café rejects the order if its own total differs. */
  expectedTotalCents?: number;
  clientRequestId: string;
}

/**
 * Where the order is on its way to the café's POS:
 *   AWAITING_CAFE    — accepted by the platform, not yet received by the café's INBYTE Café
 *   RECEIVED_BY_CAFE — INBYTE Café received it (created it, or rejected it)
 *   NOT_DELIVERED    — the café never picked it up in time; it was not placed
 */
export type OrderDeliveryState = 'AWAITING_CAFE' | 'RECEIVED_BY_CAFE' | 'NOT_DELIVERED';

/** Public-safe acknowledgement returned when the order is accepted for the café. */
export interface OrderAcknowledgement {
  /** Non-guessable reference used for tracking. Never the sequential order number. */
  publicReference: string;
  /** Café order number, e.g. ORD-1042, once INBYTE Café created the order. Display only. */
  orderNumber: string | null;
  orderStatus: CafeOrderStatus;
  paymentStatus: CafePaymentStatus;
  deliveryState: OrderDeliveryState;
  /** Platform estimate from the café's last catalog sync. */
  estimatedTotalCents: number | null;
  /** Café's authoritative amounts — null until INBYTE Café priced the order. */
  subtotalCents: number | null;
  discountCents: number | null;
  totalCents: number | null;
  createdAt: string | null;
  /** True when Café returned the original result for a repeated clientRequestId. */
  replayed: boolean;
}

/** Public-safe status snapshot read through the tracking reference. */
export interface OrderStatusSnapshot {
  publicReference: string;
  orderNumber: string | null;
  orderType: OrderType | null;
  orderStatus: CafeOrderStatus;
  paymentStatus: CafePaymentStatus;
  deliveryState: OrderDeliveryState;
  estimatedTotalCents: number | null;
  totalCents: number | null;
  rejectionReason: string | null;
  updatedAt: string | null;
}
