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

/** Public-safe acknowledgement returned by Café after it stores the order. */
export interface OrderAcknowledgement {
  /** Non-guessable reference used for tracking. Never the sequential order number. */
  publicReference: string;
  /** Café order number, e.g. ORD-1042. For display only, never a credential. */
  orderNumber: string;
  orderStatus: CafeOrderStatus;
  paymentStatus: CafePaymentStatus;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: string | null;
  /** True when Café returned the original result for a repeated clientRequestId. */
  replayed: boolean;
}

/** Public-safe status snapshot read through the tracking reference. */
export interface OrderStatusSnapshot {
  publicReference: string;
  orderNumber: string;
  orderType: OrderType | null;
  orderStatus: CafeOrderStatus;
  paymentStatus: CafePaymentStatus;
  totalCents: number | null;
  rejectionReason: string | null;
  updatedAt: string | null;
}
