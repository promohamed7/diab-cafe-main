import React, { useState } from 'react';
import { useUI } from '../context/UIContext';
import { useCart } from '../hooks/useCart';
import { useCatalog } from '../hooks/useCatalog';
import { useOrderContext } from '../hooks/useOrderContext';
import type { CheckoutPhase, SubmitBlocker } from '../hooks/useCheckout';
import { formFromAttempt, useCheckout } from '../hooks/useCheckout';
import type { CheckoutField, CheckoutFormInput } from '../domain/customer';
import { LIMITS } from '../domain/customer';
import { findOption } from '../domain/catalogIndex';
import { ORDER_STATUS_PRESENTATION, ORDER_TYPE_LABELS, paymentMethodLabel } from '../domain/orderStatus';
import { CUSTOMER_ERROR_MESSAGES } from '../integration/errors';
import { useMoney, useTenant } from '../tenant/TenantContext';
import { offeredPaymentMethods } from '../tenant/tenantPolicy';
import type { PaymentMethod } from '../types/order';

const BLOCKER_TEXT: Record<SubmitBlocker, string> = {
  CART_EMPTY: 'السلة فارغة.',
  CART_HAS_ISSUES: 'بعض الأصناف في السلة تحتاج للمراجعة قبل الإرسال.',
  MENU_NOT_LOADED: 'لم يتم تحميل المنيو من الكافيه بعد. حاول بعد لحظات.',
  TABLE_REQUIRED: 'الطلب من الطاولة يحتاج مسح كود QR الموجود على طاولتك.',
  TABLE_EXPIRED: 'انتهت جلسة الطاولة. امسح كود QR الموجود على طاولتك مرة أخرى.',
  ORDER_TYPE_DISABLED: 'هذا النوع من الطلبات غير متاح في هذا المقهى حالياً.',
  PAYMENT_METHOD_UNAVAILABLE: 'طريقة الدفع المختارة غير متاحة في هذا المقهى.',
  BELOW_MINIMUM: 'إجمالي الطلب أقل من الحد الأدنى للطلب في هذا المقهى.',
  BUSY: 'جارٍ إرسال طلبك بالفعل...'
};

/** Phases where the customer must change something before sending again. */
const NEEDS_CART_REVIEW: ReadonlySet<CheckoutPhase> = new Set<CheckoutPhase>([
  'PRICE_CHANGED',
  'OUT_OF_STOCK',
  'PRODUCT_UNAVAILABLE',
  'INVALID_MODIFIER'
]);

const emptyForm = (paymentMethod: PaymentMethod): CheckoutFormInput => ({
  fullName: '',
  phone: '',
  deliveryAddress: '',
  notes: '',
  paymentMethod
});

export const CheckoutPage: React.FC = () => {
  const money = useMoney();
  const { setActiveTab, showToast } = useUI();
  const cart = useCart();
  const { index } = useCatalog();
  const { orderType, table } = useOrderContext();
  const checkout = useCheckout();
  const { state } = checkout;
  const { tenant } = useTenant();
  // Only methods this café accepts AND the website can handle (cash/card at handover).
  const paymentMethods = offeredPaymentMethods(tenant);
  const defaultPayment: PaymentMethod = paymentMethods[0] ?? 'CASH';
  const minimumOrder = tenant.ordering.minimumOrderCents;

  const [form, setForm] = useState<CheckoutFormInput>(
    () => formFromAttempt(checkout.attempt, defaultPayment) ?? emptyForm(defaultPayment)
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [blocker, setBlocker] = useState<SubmitBlocker | null>(null);

  const update = <K extends keyof CheckoutFormInput>(key: K, value: CheckoutFormInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submitting = state.phase === 'SUBMITTING';
  const contactRequired = orderType !== 'DINE_IN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setBlocker(null);
    const result = await checkout.submit(form);
    setFieldErrors(result.fieldErrors);
    setBlocker(result.blocker);
    if (Object.keys(result.fieldErrors).length > 0) showToast('يرجى مراجعة البيانات المطلوبة.', 'error');
  };

  // ---------------- Confirmation (Café acknowledged the order) ----------------
  if ((state.phase === 'RECEIVED' || state.phase === 'SUCCESS') && state.acknowledgement && state.trackedOrder) {
    const ack = state.acknowledgement;
    const status = ORDER_STATUS_PRESENTATION[ack.orderStatus];
    return (
      <main className="page-content" style={{ paddingBottom: '6rem' }}>
        <div className="content-inner">
          <section className="checkout-result-card is-success" id="order-confirmation" aria-live="polite">
            <span className="material-symbols-outlined checkout-result-icon" aria-hidden="true">mark_email_read</span>
            <h1>وصل طلبك إلى الكافيه</h1>
            <p className="checkout-result-sub">{status.description}</p>

            <dl className="checkout-result-facts">
              <div>
                <dt>رقم الطلب</dt>
                <dd id="confirmation-order-number">{ack.orderNumber}</dd>
              </div>
              <div>
                <dt>الحالة</dt>
                <dd id="confirmation-order-status">{status.label}</dd>
              </div>
              <div>
                <dt>الإجمالي (من الكافيه)</dt>
                <dd id="confirmation-total">{money(ack.totalCents)}</dd>
              </div>
              <div>
                <dt>طريقة الدفع</dt>
                <dd>{paymentMethodLabel(state.trackedOrder.paymentMethod, state.trackedOrder.orderType)}</dd>
              </div>
              {state.trackedOrder.tableLabel && (
                <div>
                  <dt>الطاولة</dt>
                  <dd>{state.trackedOrder.tableLabel}</dd>
                </div>
              )}
            </dl>
            {ack.replayed && (
              <p className="summary-note">تم التأكد من أن طلبك وصل مرة واحدة فقط — لم يتم تكراره.</p>
            )}

            <button type="button" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('order')}>
              <span>تتبع حالة الطلب</span>
              <span className="material-symbols-outlined">near_me</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                checkout.resetToIdle();
                setForm(emptyForm(defaultPayment));
                setActiveTab('menu');
              }}
            >
              <span>طلب جديد من المنيو</span>
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (cart.itemCount === 0 && !checkout.hasUnresolvedAttempt) {
    return (
      <main className="page-content">
        <div className="content-inner">
          <div className="catalog-state-card">
            <span className="material-symbols-outlined catalog-state-icon" aria-hidden="true">shopping_bag</span>
            <h2>السلة فارغة</h2>
            <button type="button" className="btn-primary" onClick={() => setActiveTab('menu')}>
              <span>تصفح المنيو</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const errorPhase = !['IDLE', 'SUBMITTING', 'RECEIVED', 'SUCCESS'].includes(state.phase);
  const showUnresolvedBanner = checkout.hasUnresolvedAttempt && !submitting;

  return (
    <main className="page-content" style={{ paddingBottom: '6rem' }}>
      <div className="content-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800 }}>إتمام وتأكيد الطلب</h1>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
              سيصل طلبك للكافيه للمراجعة والتأكيد
            </p>
          </div>
          <button type="button" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }} onClick={() => setActiveTab('cart')}>
            ← العودة للسلة
          </button>
        </div>

        {/* Order type (read-only here) */}
        <div style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(var(--brand-rgb), 0.25)', borderRadius: '16px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '22px' }}>
            {orderType === 'DINE_IN' ? 'table_restaurant' : orderType === 'PICKUP' ? 'store' : 'two_wheeler'}
          </span>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: 700 }} id="checkout-order-type">
              {orderType === 'DINE_IN' && table ? `${ORDER_TYPE_LABELS.DINE_IN} — ${table.tableLabel}` : ORDER_TYPE_LABELS[orderType]}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>
              {orderType === 'DINE_IN'
                ? 'يصل طلبك لفريق الكافيه مرتبطاً بطاولتك'
                : orderType === 'PICKUP'
                ? 'استلم طلبك من الفرع بعد تأكيده'
                : 'يتواصل معك الكافيه لتأكيد التوصيل'}
            </span>
          </div>
        </div>

        {showUnresolvedBanner && (
          <div
            className="checkout-status-panel is-warning"
            role="alert"
            id="unresolved-attempt-banner"
            data-phase={state.phase}
            data-request-id={checkout.attempt?.clientRequestId ?? ''}
          >
            {state.errorCode && state.errorCode !== 'UNKNOWN' && <span>{CUSTOMER_ERROR_MESSAGES[state.errorCode]}</span>}
            <strong>لم نتأكد بعد إن كان طلبك السابق قد وصل للكافيه.</strong>
            <span>أعد إرسال نفس الطلب للتأكد — لن يتكرر الطلب إذا كان قد وصل بالفعل.</span>
            <button type="button" className="btn-primary" onClick={async () => setBlocker(await checkout.retryUnresolved())} id="retry-previous-btn">
              <span>إعادة إرسال نفس الطلب</span>
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <span className="summary-note">إذا عدّلت السلة أو البيانات، سيُرسل كطلب جديد منفصل.</span>
          </div>
        )}

        {errorPhase && !showUnresolvedBanner && state.errorCode && (
          <div
            className={`checkout-status-panel ${state.phase === 'FAILED' ? 'is-warning' : 'is-error'}`}
            role="alert"
            id="checkout-status-panel"
            data-phase={state.phase}
            data-request-id={state.lastRequestId ?? ''}
          >
            <strong>{CUSTOMER_ERROR_MESSAGES[state.errorCode]}</strong>
            {NEEDS_CART_REVIEW.has(state.phase) && (
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('cart')}>
                مراجعة السلة
              </button>
            )}
          </div>
        )}

        {blocker && (
          <div className="inline-notice is-error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">info</span>
            <span>{BLOCKER_TEXT[blocker]}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <fieldset disabled={submitting} className="checkout-fieldset">
            <div className="checkout-box">
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--on-surface)' }}>
                {contactRequired ? 'بيانات التواصل:' : 'بياناتك (اختياري):'}
              </h3>

              <div>
                <label className="checkout-label" htmlFor="checkout-name">الاسم {contactRequired && '*'}</label>
                <input
                  id="checkout-name"
                  type="text"
                  className="checkout-input"
                  autoComplete="name"
                  maxLength={LIMITS.nameMax}
                  value={form.fullName}
                  aria-invalid={!!fieldErrors.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  style={{ width: '100%' }}
                />
                {fieldErrors.fullName && <p className="field-error">{fieldErrors.fullName}</p>}
              </div>

              <div>
                <label className="checkout-label" htmlFor="checkout-phone">رقم الهاتف {contactRequired && '*'}</label>
                <input
                  id="checkout-phone"
                  type="tel"
                  inputMode="tel"
                  className="checkout-input"
                  autoComplete="tel"
                  maxLength={20}
                  value={form.phone}
                  aria-invalid={!!fieldErrors.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  style={{ width: '100%', direction: 'ltr', textAlign: 'right' }}
                />
                {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
              </div>

              {orderType === 'DELIVERY' && (
                <div>
                  <label className="checkout-label" htmlFor="checkout-address">عنوان التوصيل *</label>
                  <textarea
                    id="checkout-address"
                    className="checkout-input"
                    autoComplete="street-address"
                    placeholder="المدينة، الشارع، رقم العمارة، الدور والشقة، وأي علامة مميزة"
                    maxLength={LIMITS.addressMax}
                    rows={3}
                    value={form.deliveryAddress}
                    aria-invalid={!!fieldErrors.deliveryAddress}
                    onChange={(e) => update('deliveryAddress', e.target.value)}
                    style={{ width: '100%', height: 'auto', padding: '0.65rem' }}
                  />
                  {fieldErrors.deliveryAddress && <p className="field-error">{fieldErrors.deliveryAddress}</p>}
                </div>
              )}

              <div>
                <label className="checkout-label" htmlFor="checkout-notes">ملاحظات للكافيه (اختياري)</label>
                <textarea
                  id="checkout-notes"
                  className="checkout-input"
                  placeholder="مثال: ثلج إضافي، السكر منفصل..."
                  maxLength={LIMITS.notesMax}
                  rows={2}
                  value={form.notes}
                  aria-invalid={!!fieldErrors.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  style={{ width: '100%', height: 'auto', padding: '0.65rem' }}
                />
                <span className="char-counter">{form.notes.length}/{LIMITS.notesMax}</span>
                {fieldErrors.notes && <p className="field-error">{fieldErrors.notes}</p>}
              </div>
            </div>

            <div className="checkout-box">
              <h3 style={{ fontSize: '15px', fontWeight: 800 }}>طريقة الدفع:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} role="radiogroup">
                {paymentMethods.map((method) => (
                  <label key={method} className={`payment-option ${form.paymentMethod === method ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="payMethod"
                      value={method}
                      checked={form.paymentMethod === method}
                      onChange={() => update('paymentMethod', method)}
                    />
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                      {method === 'CASH' ? 'payments' : 'credit_card'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{paymentMethodLabel(method, orderType)}</span>
                  </label>
                ))}
              </div>
              <p className="summary-note">لا يتم أي دفع عبر الموقع. يتم الدفع مع فريق الكافيه.</p>
            </div>

            {/* Review */}
            <div className="checkout-box">
              <h3 style={{ fontSize: '14px', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
                مراجعة الأصناف ({cart.itemCount}):
              </h3>
              {cart.reconciled.map(({ line, estimatedCents }) => {
                const product = index?.productsById.get(line.productId);
                const options = product
                  ? line.modifierOptionIds.map((id) => findOption(product, id)?.option.name).filter(Boolean).join('، ')
                  : '';
                return (
                  <div key={line.lineId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '12.5px' }}>
                    <span>
                      {line.quantity}× {product?.name ?? 'صنف'} {options ? `(${options})` : ''}
                    </span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{money(estimatedCents)}</span>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: 'var(--primary)', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span>الإجمالي التقديري:</span>
                <span id="checkout-estimated-total">{money(cart.estimatedTotalCents)}</span>
              </div>
              <p className="summary-note">يؤكد الكافيه الإجمالي النهائي عند استلام الطلب. إذا تغيرت الأسعار سنطلب منك المراجعة قبل الإرسال.</p>
              {minimumOrder !== null && (
                <p className="summary-note" id="checkout-minimum-note">الحد الأدنى للطلب: {money(minimumOrder)}</p>
              )}

              <button
                type="submit"
                id="checkout-submit"
                className="btn-primary"
                disabled={submitting || cart.hasIssues || cart.itemCount === 0}
                style={{ width: '100%', height: '3.25rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '14px' }}
              >
                {submitting ? (
                  <span>جارٍ إرسال الطلب للكافيه...</span>
                ) : state.phase === 'FAILED' ? (
                  <>
                    <span>إعادة المحاولة</span>
                    <span className="material-symbols-outlined">refresh</span>
                  </>
                ) : (
                  <>
                    <span>إرسال الطلب للكافيه</span>
                    <span className="material-symbols-outlined">send</span>
                  </>
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
};
