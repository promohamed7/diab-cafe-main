import React, { useEffect, useState } from 'react';
import { useUI } from '../context/UIContext';
import { useCatalog } from '../hooks/useCatalog';
import { useOrderTracking, useTrackedOrders } from '../hooks/useOrderTracking';
import { formatMoney } from '../domain/pricing';
import {
  ORDER_STATUS_PRESENTATION,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PROGRESS_STEPS,
  paymentMethodLabel,
  progressIndex
} from '../domain/orderStatus';
import { parseCafeTimestamp } from '../integration/parsers';
import { CUSTOMER_ERROR_MESSAGES } from '../integration/errors';

const STEP_NUMERALS = ['١', '٢', '٣', '٤', '٥'];

function formatTime(value: string | null): string {
  const d = parseCafeTimestamp(value);
  return d ? d.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
}

/**
 * Read-only order tracking. Status, payment status and totals come from Café
 * through the public tracking reference. There are no controls that change an
 * order: cancellations and status changes are staff operations in the POS.
 */
export const OrderTrackingPage: React.FC = () => {
  const { setActiveTab } = useUI();
  const { index } = useCatalog();
  const orders = useTrackedOrders();
  const [selectedRef, setSelectedRef] = useState<string | null>(orders[0]?.publicReference ?? null);

  // Follow the newest order when a new one is placed.
  useEffect(() => {
    if (orders.length > 0 && !orders.some((o) => o.publicReference === selectedRef)) {
      setSelectedRef(orders[0].publicReference);
    }
  }, [orders, selectedRef]);

  const tracked = orders.find((o) => o.publicReference === selectedRef) ?? null;
  const { snapshot, loading, errorCode, lastCheckedAt, refresh } = useOrderTracking(tracked?.publicReference ?? null);

  if (!tracked) {
    return (
      <main className="page-content">
        <div className="content-inner">
          <div className="empty-state-card" style={{ display: 'flex' }}>
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <h2 style={{ fontFamily: 'var(--ff-arabic)', fontSize: '18px', color: 'var(--on-surface)' }}>لا توجد طلبات على هذا الجهاز</h2>
            <p style={{ fontFamily: 'var(--ff-arabic)', fontSize: '13px', color: 'var(--on-surface-variant)', maxWidth: '20rem' }}>
              بعد إرسال طلبك يمكنك متابعة حالته هنا كما يحدّثها فريق الكافيه.
            </p>
            <button onClick={() => setActiveTab('menu')} className="btn-primary" style={{ marginTop: '0.5rem' }} type="button">
              <span>ابدأ طلباً من المنيو</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>local_cafe</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const status = snapshot?.orderStatus ?? null;
  const presentation = status ? ORDER_STATUS_PRESENTATION[status] : null;
  const stepIndex = status ? progressIndex(status) : -1;
  const isStopped = status === 'REJECTED' || status === 'CANCELLED';
  const totalCents = snapshot?.totalCents ?? tracked.acknowledgedTotalCents;
  const storePhone = index?.catalog.store.phone ?? null;

  return (
    <main className="page-content">
      <div className="content-inner">
        <h1 className="sr-only">تتبع حالة الطلب — دياب كافيه</h1>

        {orders.length > 1 && (
          <div className="tracked-orders-switcher" role="tablist" aria-label="طلباتك على هذا الجهاز">
            {orders.map((o) => (
              <button
                key={o.publicReference}
                type="button"
                role="tab"
                aria-selected={o.publicReference === tracked.publicReference}
                className={`cat-chip ${o.publicReference === tracked.publicReference ? 'is-selected' : ''}`}
                onClick={() => setSelectedRef(o.publicReference)}
              >
                {o.orderNumber}
              </button>
            ))}
          </div>
        )}

        <div className="order-tracking-grid">
          <div className="order-tracking-main-col">
            <section className="tracking-header-card" aria-label="بيانات الطلب">
              <div className="tracking-top-meta">
                <span className="tracking-order-number" id="track-order-number">{tracked.orderNumber}</span>
                {presentation ? (
                  <div className={`tracking-status-pill status-pill--${presentation.tone}`} id="track-status-pill" data-status={status ?? ''}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{presentation.icon}</span>
                    <span>{presentation.label}</span>
                  </div>
                ) : (
                  <div className="tracking-status-pill status-pill--pending" id="track-status-pill">
                    <span>{loading ? 'جارٍ التحديث...' : 'الحالة غير متاحة الآن'}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem', fontFamily: 'var(--ff-arabic)', fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '0.4rem' }}>
                <span id="track-mode-badge" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {tracked.orderType === 'DINE_IN' && tracked.tableLabel
                    ? `${ORDER_TYPE_LABELS.DINE_IN} — ${tracked.tableLabel}`
                    : ORDER_TYPE_LABELS[tracked.orderType]}
                </span>
                <span id="track-order-date">{formatTime(tracked.placedAt)}</span>
              </div>

              {presentation && <p className="tracking-status-desc">{presentation.description}</p>}

              {isStopped && (
                <div id="track-rejection-alert" className="inline-notice is-error" role="alert" style={{ marginTop: '0.75rem' }}>
                  <span className="material-symbols-outlined" aria-hidden="true">error</span>
                  <span>
                    <strong>{presentation?.label}</strong>
                    {snapshot?.rejectionReason && <span id="track-rejection-msg"> — {snapshot.rejectionReason}</span>}
                  </span>
                </div>
              )}

              {errorCode && (
                <div className="inline-notice is-warning" role="status" style={{ marginTop: '0.75rem' }}>
                  <span className="material-symbols-outlined" aria-hidden="true">sync_problem</span>
                  <span>{errorCode === 'ORDER_NOT_FOUND' ? CUSTOMER_ERROR_MESSAGES.ORDER_NOT_FOUND : 'تعذر تحديث حالة الطلب الآن. سنحاول مرة أخرى تلقائياً.'}</span>
                </div>
              )}

              <div className="tracking-refresh-row">
                <span>{lastCheckedAt ? `آخر تحديث: ${new Date(lastCheckedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                <button type="button" className="inline-notice-action" onClick={() => void refresh()} disabled={loading} id="track-refresh-btn">
                  {loading ? 'جارٍ التحديث...' : 'تحديث الحالة'}
                </button>
              </div>
            </section>

            {!isStopped && (
              <section className="tracking-stepper-box" aria-label="مراحل الطلب">
                {PROGRESS_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className={`stepper-step-item ${stepIndex >= i ? 'is-active' : ''} ${stepIndex > i || (step === 'COMPLETED' && stepIndex === i) ? 'is-completed' : ''}`}
                    id={`step-${step.toLowerCase()}`}
                  >
                    <div className="step-marker-circle">{STEP_NUMERALS[i]}</div>
                    <div className="step-content-text">
                      <span className="step-title">{ORDER_STATUS_PRESENTATION[step].label}</span>
                      <span className="step-desc">{ORDER_STATUS_PRESENTATION[step].description}</span>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>

          <aside className="order-tracking-side-col">
            <section className="checkout-section-card" aria-label="تفاصيل الطلب">
              <div className="checkout-section-title">
                <span className="material-symbols-outlined">receipt</span>
                <span>ما طلبته</span>
              </div>

              <div id="track-receipt-items">
                {tracked.items.map((item, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0', borderBottom: '1px solid rgba(244, 189, 97, 0.12)' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--on-surface)' }}>
                      {item.quantity} × {item.name}
                    </div>
                    {item.options.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '0.15rem' }}>{item.options.join(' • ')}</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed rgba(200, 150, 62, 0.2)', paddingTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div className="summary-row total-row">
                  <span>الإجمالي (من الكافيه):</span>
                  <span id="track-total">{formatMoney(totalCents)}</span>
                </div>
              </div>

              <div className="tracking-payment-row">
                <span>الدفع:</span>
                <strong style={{ color: 'var(--primary)' }}>{paymentMethodLabel(tracked.paymentMethod, tracked.orderType)}</strong>
              </div>
              {snapshot && (
                <div className="tracking-payment-row">
                  <span>حالة الدفع:</span>
                  <strong id="track-payment-status">{PAYMENT_STATUS_LABELS[snapshot.paymentStatus]}</strong>
                </div>
              )}
            </section>

            {storePhone && (
              <a href={`tel:${storePhone}`} className="btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>call</span>
                <span>اتصال بالكافيه</span>
              </a>
            )}

            <button onClick={() => setActiveTab('menu')} className="btn-primary" style={{ justifyContent: 'center', height: '3.25rem', width: '100%' }} type="button">
              <span>طلب جديد من المنيو</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
};
