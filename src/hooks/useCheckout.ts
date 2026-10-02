import { useCallback, useMemo, useRef, useState } from 'react';
import type { OrderAcknowledgement, PaymentMethod } from '../types/order';
import type { CheckoutAttempt, OrderDraft } from '../domain/checkoutAttempt';
import { buildOrderDraft, canonicalJson, resolveAttempt } from '../domain/checkoutAttempt';
import type { CheckoutFormInput, CheckoutField } from '../domain/customer';
import { validateCheckoutInput } from '../domain/customer';
import { findOption } from '../domain/catalogIndex';
import type { CafeErrorCode } from '../integration/errors';
import { toCafeError } from '../integration/errors';
import { submitOrder } from '../services/cafeOrderService';
import { createCheckoutAttemptStore } from '../services/checkoutAttemptStore';
import type { TrackedOrder } from '../services/trackedOrdersStore';
import { trackedOrdersStore } from '../services/trackedOrdersStore';
import { useTenant } from '../tenant/TenantContext';
import { meetsMinimumOrder, offeredPaymentMethods } from '../tenant/tenantPolicy';
import { useCart } from './useCart';
import { useCatalog } from './useCatalog';
import { useOrderContext } from './useOrderContext';

export type CheckoutPhase =
  | 'IDLE'
  | 'SUBMITTING'
  /** Café stored the order; it is waiting for staff (PENDING). */
  | 'RECEIVED'
  /** Café returned an order that has already moved past PENDING (e.g. a replay). */
  | 'SUCCESS'
  /** Outcome unknown (network/timeout/5xx). Retrying reuses the same clientRequestId. */
  | 'FAILED'
  | 'REJECTED'
  | 'PRICE_CHANGED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'OUT_OF_STOCK'
  | 'PRODUCT_UNAVAILABLE'
  | 'INVALID_MODIFIER'
  | 'INVALID_TABLE'
  | 'CUSTOMER_DATA_REQUIRED'
  | 'NOT_CONFIGURED';

export interface CheckoutState {
  phase: CheckoutPhase;
  errorCode: CafeErrorCode | null;
  acknowledgement: OrderAcknowledgement | null;
  trackedOrder: TrackedOrder | null;
  /** The clientRequestId used by the latest send (exposed for transparency/testing). */
  lastRequestId: string | null;
  /** True when the latest send reused the previous id (a retry of the same attempt). */
  lastSendWasRetry: boolean;
}

export type SubmitBlocker =
  | 'CART_EMPTY'
  | 'CART_HAS_ISSUES'
  | 'MENU_NOT_LOADED'
  | 'TABLE_REQUIRED'
  | 'TABLE_EXPIRED'
  | 'ORDER_TYPE_DISABLED'
  | 'PAYMENT_METHOD_UNAVAILABLE'
  | 'BELOW_MINIMUM'
  | 'BUSY';

export interface SubmitResult {
  fieldErrors: Partial<Record<CheckoutField, string>>;
  blocker: SubmitBlocker | null;
}

function phaseForError(code: CafeErrorCode, outcomeUnknown: boolean): CheckoutPhase {
  if (outcomeUnknown) return 'FAILED';
  switch (code) {
    case 'PRICE_TAMPERED_MISMATCH': return 'PRICE_CHANGED';
    case 'IDEMPOTENCY_KEY_CONFLICT': return 'IDEMPOTENCY_CONFLICT';
    case 'INSUFFICIENT_STOCK': return 'OUT_OF_STOCK';
    case 'PRODUCT_INACTIVE':
    case 'PRODUCT_UNAVAILABLE': return 'PRODUCT_UNAVAILABLE';
    case 'INVALID_MODIFIER_OPTION': return 'INVALID_MODIFIER';
    case 'INVALID_TABLE_TOKEN': return 'INVALID_TABLE';
    case 'CUSTOMER_DATA_REQUIRED': return 'CUSTOMER_DATA_REQUIRED';
    case 'NOT_CONFIGURED': return 'NOT_CONFIGURED';
    default: return 'REJECTED';
  }
}

/** An attempt whose result Café never confirmed (lost response, crash, offline...). */
export function isUnresolved(attempt: CheckoutAttempt | null): attempt is CheckoutAttempt {
  return attempt !== null && (attempt.status === 'OUTCOME_UNKNOWN' || attempt.status === 'PENDING_SEND');
}

export function useCheckout() {
  const cart = useCart();
  const { index, reload: reloadCatalog } = useCatalog();
  const orderCtx = useOrderContext();
  const { tenant, scope } = useTenant();
  // Attempts (and their clientRequestIds) live in this café's scope only.
  const attemptStore = useMemo(() => createCheckoutAttemptStore(scope), [scope]);
  const loadStoredAttempt = attemptStore.load;
  const orders = useMemo(() => trackedOrdersStore(scope), [scope]);

  const [attempt, setAttemptState] = useState<CheckoutAttempt | null>(() => attemptStore.load());
  const [state, setState] = useState<CheckoutState>(() => ({
    phase: isUnresolved(attemptStore.load()) ? 'FAILED' : 'IDLE',
    errorCode: isUnresolved(attemptStore.load()) ? 'UNKNOWN' : null,
    acknowledgement: null,
    trackedOrder: null,
    lastRequestId: null,
    lastSendWasRetry: false
  }));
  const inFlight = useRef(false);

  const persistAttempt = useCallback(
    (next: CheckoutAttempt | null) => {
      attemptStore.save(next);
      setAttemptState(next);
    },
    [attemptStore]
  );

  /** Snapshot of what the customer asked for, for the device-local tracking view. */
  const describeItems = useCallback(
    (draft: OrderDraft): TrackedOrder['items'] =>
      draft.items.map((item) => {
        const product = index?.productsById.get(item.productId);
        return {
          name: product?.name ?? 'صنف',
          quantity: item.quantity,
          options: product
            ? item.modifierOptionIds.map((id) => findOption(product, id)?.option.name).filter((n): n is string => !!n)
            : []
        };
      }),
    [index]
  );

  const send = useCallback(
    async (toSend: CheckoutAttempt, reused: boolean, clearCartOnSuccess: boolean) => {
      inFlight.current = true;
      // Persist BEFORE the network call: if the tab dies mid-request, the next
      // attempt still reuses this id instead of risking a duplicate order.
      const sending: CheckoutAttempt = { ...toSend, status: 'PENDING_SEND', sendCount: toSend.sendCount + 1 };
      persistAttempt(sending);
      setState((s) => ({
        ...s,
        phase: 'SUBMITTING',
        errorCode: null,
        lastRequestId: sending.clientRequestId,
        lastSendWasRetry: reused
      }));

      try {
        const ack = await submitOrder(scope, sending.request);
        const { clientRequestId: _id, ...draft } = sending.request;
        const tracked: TrackedOrder = {
          tenantId: scope.tenantId,
          publicReference: ack.publicReference,
          orderNumber: ack.orderNumber,
          orderType: sending.request.orderType,
          tableLabel: sending.request.orderType === 'DINE_IN' ? orderCtx.table?.tableLabel ?? null : null,
          paymentMethod: sending.request.paymentMethod,
          acknowledgedTotalCents: ack.totalCents ?? ack.estimatedTotalCents,
          placedAt: ack.createdAt ?? new Date().toISOString(),
          items: describeItems(draft)
        };
        orders.add(tracked);
        // Acknowledged: this id is finished and must never be reused.
        persistAttempt(null);
        if (clearCartOnSuccess) cart.clear();
        setState((s) => ({
          ...s,
          phase: ack.orderStatus === 'PENDING' ? 'RECEIVED' : 'SUCCESS',
          errorCode: null,
          acknowledgement: ack,
          trackedOrder: tracked
        }));
      } catch (error) {
        const e = toCafeError(error);
        persistAttempt({ ...sending, status: e.outcomeUnknown ? 'OUTCOME_UNKNOWN' : 'REJECTED' });
        setState((s) => ({ ...s, phase: phaseForError(e.code, e.outcomeUnknown), errorCode: e.code }));
        if (e.code === 'PRICE_TAMPERED_MISMATCH' || e.code === 'PRODUCT_INACTIVE' || e.code === 'PRODUCT_UNAVAILABLE' ||
            e.code === 'INVALID_MODIFIER_OPTION' || e.code === 'INSUFFICIENT_STOCK') {
          // Refresh the menu so the cart shows Café's current prices/availability.
          void reloadCatalog();
        }
        if (e.code === 'INVALID_TABLE_TOKEN') orderCtx.invalidateTable();
      } finally {
        inFlight.current = false;
      }
    },
    [cart, describeItems, orderCtx, persistAttempt, reloadCatalog, scope, orders]
  );

  const submit = useCallback(
    async (form: CheckoutFormInput): Promise<SubmitResult> => {
      const none: SubmitResult = { fieldErrors: {}, blocker: null };
      if (inFlight.current) return { ...none, blocker: 'BUSY' };
      if (cart.lines.length === 0) return { ...none, blocker: 'CART_EMPTY' };
      if (!index || cart.estimatedTotalCents === null) return { ...none, blocker: 'MENU_NOT_LOADED' };
      if (cart.hasIssues) return { ...none, blocker: 'CART_HAS_ISSUES' };

      const { orderType, table } = orderCtx;
      if (!orderCtx.orderTypeEnabled) return { ...none, blocker: 'ORDER_TYPE_DISABLED' };
      if (!meetsMinimumOrder(tenant, cart.estimatedTotalCents)) return { ...none, blocker: 'BELOW_MINIMUM' };
      if (!offeredPaymentMethods(tenant).includes(form.paymentMethod)) {
        return { ...none, blocker: 'PAYMENT_METHOD_UNAVAILABLE' };
      }
      if (orderType === 'DINE_IN') {
        if (!table) return { ...none, blocker: 'TABLE_REQUIRED' };
        if (orderCtx.isTableExpired()) return { ...none, blocker: 'TABLE_EXPIRED' };
      }

      const { values, errors } = validateCheckoutInput(form, orderType);
      if (Object.keys(errors).length > 0) return { fieldErrors: errors, blocker: null };

      const draft = buildOrderDraft({
        orderType,
        tableToken: orderType === 'DINE_IN' ? table?.token ?? null : null,
        lines: cart.lines,
        customer: values,
        expectedTotalCents: cart.estimatedTotalCents
      });
      const { attempt: next, reused } = resolveAttempt(loadStoredAttempt(), draft, { tenantId: scope.tenantId });
      await send(next, reused, true);
      return none;
    },
    [cart, index, orderCtx, send, tenant, scope, loadStoredAttempt]
  );

  /**
   * Re-sends the stored unresolved attempt exactly as it was (same payload, same
   * clientRequestId). Café either stores it once or returns the original order.
   */
  const retryUnresolved = useCallback(async (): Promise<SubmitBlocker | null> => {
    const stored = loadStoredAttempt();
    if (!isUnresolved(stored)) return null;
    if (inFlight.current) return 'BUSY';
    // A dine-in retry is only allowed for the same, still-valid table session.
    if (stored.request.orderType === 'DINE_IN') {
      const { table } = orderCtx;
      if (!table || table.token !== stored.request.tableToken) return 'TABLE_REQUIRED';
      if (orderCtx.isTableExpired()) return 'TABLE_EXPIRED';
    }
    // Only clear the cart if it still matches what was sent.
    const sentItems = canonicalJson(stored.request.items);
    const currentItems = canonicalJson(
      cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, modifierOptionIds: l.modifierOptionIds }))
    );
    await send(stored, true, sentItems === currentItems);
    return null;
  }, [cart.lines, orderCtx, send, loadStoredAttempt]);

  const resetToIdle = useCallback(() => {
    setState((s) => ({ ...s, phase: 'IDLE', errorCode: null, acknowledgement: null, trackedOrder: null }));
  }, []);

  return {
    state,
    attempt,
    hasUnresolvedAttempt: isUnresolved(attempt),
    submit,
    retryUnresolved,
    resetToIdle
  };
}

/** Pre-fills the checkout form from an unresolved attempt so an unchanged retry keeps the same id. */
export function formFromAttempt(attempt: CheckoutAttempt | null, fallbackPayment: PaymentMethod): CheckoutFormInput | null {
  if (!isUnresolved(attempt)) return null;
  const c = attempt.request.customerInfo;
  return {
    fullName: c.fullName ?? '',
    phone: c.phone ?? '',
    deliveryAddress: c.deliveryAddress ?? '',
    notes: c.customerNotes ?? '',
    paymentMethod: attempt.request.paymentMethod ?? fallbackPayment
  };
}
