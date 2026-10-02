// Checkout attempt + clientRequestId lifecycle.
//
// Rules (Café idempotency contract):
//  1. Every new checkout attempt gets a fresh high-entropy clientRequestId.
//  2. The id is saved together with the exact payload before anything is sent.
//  3. If the outcome is unknown (network error, timeout, lost response, 5xx),
//     a retry of the SAME payload reuses the SAME id.
//  4. If anything in the payload changes (cart, quantities, modifiers, order type,
//     table token, name, phone, address, notes, payment method, expected total),
//     a NEW id is generated.
//  5. Once Café acknowledged or definitively rejected an attempt, its id is never
//     reused for another submission.
//  6. An attempt belongs to exactly one tenant (café). Its tenantId is part of
//     the record and of the fingerprint, so it can never be reused, restored or
//     replayed under another tenant.

import type { CafeId } from '../types/catalog.ts';
import type { OrderType, SubmitOrderRequest } from '../types/order.ts';
import type { NormalizedCustomer } from './customer.ts';
import { normalizeOptionIds } from './modifiers.ts';

export type OrderDraft = Omit<SubmitOrderRequest, 'clientRequestId'>;

export interface DraftLine {
  productId: CafeId;
  quantity: number;
  modifierOptionIds: readonly CafeId[];
}

export interface DraftInput {
  orderType: OrderType;
  tableToken: string | null;
  lines: readonly DraftLine[];
  customer: NormalizedCustomer;
  expectedTotalCents: number | null;
}

export type AttemptStatus = 'PENDING_SEND' | 'OUTCOME_UNKNOWN' | 'ACKNOWLEDGED' | 'REJECTED';

export interface CheckoutAttempt {
  /** The café this attempt belongs to. */
  tenantId: string;
  clientRequestId: string;
  fingerprint: string;
  request: SubmitOrderRequest;
  createdAt: number;
  status: AttemptStatus;
  sendCount: number;
}

/** Unknown-outcome attempts older than this are not reused automatically. */
export const ATTEMPT_REUSE_TTL_MS = 12 * 60 * 60 * 1000;

export class DraftError extends Error {
  constructor(message: 'TABLE_TOKEN_REQUIRED' | 'EMPTY_CART') {
    super(message);
    this.name = 'DraftError';
  }
}

/** Builds the only payload the website ever sends. Fields appear only when applicable. */
export function buildOrderDraft(input: DraftInput): OrderDraft {
  if (input.lines.length === 0) throw new DraftError('EMPTY_CART');
  const isDineIn = input.orderType === 'DINE_IN';
  if (isDineIn && !input.tableToken) throw new DraftError('TABLE_TOKEN_REQUIRED');

  const c = input.customer;
  const customerInfo: OrderDraft['customerInfo'] = {};
  if (c.fullName) customerInfo.fullName = c.fullName;
  if (c.phone) customerInfo.phone = c.phone;
  if (input.orderType === 'DELIVERY' && c.deliveryAddress) customerInfo.deliveryAddress = c.deliveryAddress;
  if (c.notes) customerInfo.customerNotes = c.notes;

  const draft: OrderDraft = {
    orderType: input.orderType,
    orderChannel: isDineIn ? 'TABLE_QR' : 'ONLINE',
    items: input.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      modifierOptionIds: normalizeOptionIds(l.modifierOptionIds)
    })),
    customerInfo,
    paymentMethod: c.paymentMethod
  };
  if (isDineIn && input.tableToken) draft.tableToken = input.tableToken;
  if (typeof input.expectedTotalCents === 'number') draft.expectedTotalCents = input.expectedTotalCents;
  return draft;
}

/** Deterministic JSON with sorted object keys (array order is preserved). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintDraft(draft: OrderDraft): string {
  return canonicalJson(draft);
}

/** Fingerprint of an attempt: the payload *and* the tenant it is sent to. */
export function fingerprintAttempt(tenantId: string, draft: OrderDraft): string {
  return canonicalJson({ tenantId, draft });
}

/** RFC 4122 v4 UUID from the platform CSPRNG. Works outside secure contexts too. */
export function generateRequestId(): string {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('A cryptographically secure random source is required');
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface ResolvedAttempt {
  attempt: CheckoutAttempt;
  reused: boolean;
}

export interface ResolveAttemptOptions {
  tenantId: string;
  newId?: () => string;
  now?: number;
}

export function resolveAttempt(
  existing: CheckoutAttempt | null,
  draft: OrderDraft,
  options: ResolveAttemptOptions
): ResolvedAttempt {
  const { tenantId, newId = generateRequestId, now = Date.now() } = options;
  const fingerprint = fingerprintAttempt(tenantId, draft);
  const reusable =
    existing !== null &&
    existing.tenantId === tenantId &&
    existing.fingerprint === fingerprint &&
    (existing.status === 'OUTCOME_UNKNOWN' || existing.status === 'PENDING_SEND') &&
    now - existing.createdAt < ATTEMPT_REUSE_TTL_MS;

  if (reusable) return { attempt: existing, reused: true };

  const clientRequestId = newId();
  return {
    attempt: {
      tenantId,
      clientRequestId,
      fingerprint,
      request: { ...draft, clientRequestId },
      createdAt: now,
      status: 'PENDING_SEND',
      sendCount: 0
    },
    reused: false
  };
}

const ATTEMPT_STATUSES: readonly AttemptStatus[] = ['PENDING_SEND', 'OUTCOME_UNKNOWN', 'ACKNOWLEDGED', 'REJECTED'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Restores a persisted attempt for `tenantId`; anything malformed or from another tenant is discarded. */
export function sanitizeStoredAttempt(raw: unknown, tenantId: string): CheckoutAttempt | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const a = raw as Record<string, unknown>;
  if (a.tenantId !== tenantId) return null;
  if (typeof a.clientRequestId !== 'string' || !UUID_RE.test(a.clientRequestId)) return null;
  if (typeof a.fingerprint !== 'string' || typeof a.createdAt !== 'number') return null;
  if (typeof a.status !== 'string' || !(ATTEMPT_STATUSES as readonly string[]).includes(a.status)) return null;
  if (typeof a.request !== 'object' || a.request === null) return null;
  const request = a.request as SubmitOrderRequest;
  if (request.clientRequestId !== a.clientRequestId) return null;
  const { clientRequestId: _omit, ...draft } = request;
  if (fingerprintAttempt(tenantId, draft) !== a.fingerprint) return null;
  return {
    tenantId,
    clientRequestId: a.clientRequestId,
    fingerprint: a.fingerprint,
    request,
    createdAt: a.createdAt,
    status: a.status as AttemptStatus,
    sendCount: typeof a.sendCount === 'number' ? a.sendCount : 0
  };
}
