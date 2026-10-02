import React from 'react';
import { useMoney } from '../tenant/TenantContext';
import { useUI } from '../context/UIContext';
import { useCart } from '../hooks/useCart';
import { useCatalog } from '../hooks/useCatalog';
import { useOrderContext } from '../hooks/useOrderContext';
import { findOption } from '../domain/catalogIndex';
import type { CartLineIssue } from '../domain/cart';
import { MAX_QUANTITY_PER_LINE } from '../domain/cart';
import { ORDER_TYPE_LABELS } from '../domain/orderStatus';
import { useTenant } from '../tenant/TenantContext';
import { createCheckoutAttemptStore } from '../services/checkoutAttemptStore';
import { isUnresolved } from '../hooks/useCheckout';

const ISSUE_TEXT: Record<CartLineIssue, string> = {
  PRODUCT_NOT_IN_MENU: 'لم يعد هذا الصنف في المنيو. يرجى حذفه.',
  PRODUCT_UNAVAILABLE: 'هذا الصنف غير متاح حالياً. يرجى حذفه.',
  INVALID_MODIFIERS: 'تغيرت اختيارات هذا الصنف في المنيو. احذفه وأضفه من جديد.'
};

export const CartPage: React.FC = () => {
  const money = useMoney();
  const { setActiveTab } = useUI();
  const { reconciled, itemCount, estimatedTotalCents, hasIssues, setQuantity, removeLine, clear } = useCart();
  const { index } = useCatalog();
  const { orderType, table, orderTypeEnabled } = useOrderContext();
  const { scope } = useTenant();

  if (itemCount === 0) {
    // A previous submission whose result is unknown must stay reachable even with an empty cart.
    const pendingAttempt = isUnresolved(createCheckoutAttemptStore(scope).load());
    return (
      <main className="page-content">
        <div className="content-inner">
          {pendingAttempt && (
            <div className="checkout-status-panel is-warning" role="alert" id="cart-unresolved-notice">
              <strong>لم نتأكد بعد إن كان طلبك السابق قد وصل للكافيه.</strong>
              <button type="button" className="btn-primary" onClick={() => setActiveTab('checkout')} id="cart-check-previous">
                <span>التحقق من الطلب السابق</span>
              </button>
            </div>
          )}
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '5rem', height: '5rem', borderRadius: '9999px', background: 'rgba(var(--brand-deep-rgb), 0.12)', border: '1.5px solid rgba(var(--brand-deep-rgb), 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '38px' }}>shopping_bag</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>سلة المشتريات فارغة</h2>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', maxWidth: '24rem', lineHeight: 1.6 }}>
              لم تضف أي أصناف إلى سلتك بعد. تصفح المنيو واختر ما يعجبك.
            </p>
            <button type="button" className="btn-primary" style={{ padding: '0.75rem 2rem', marginTop: '0.5rem' }} onClick={() => setActiveTab('menu')}>
              <span>تصفح المنيو واطلب الآن</span>
              <span className="material-symbols-outlined">restaurant_menu</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content" style={{ paddingBottom: '6rem' }}>
      <div className="content-inner">
        {/* Order type */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-container-high)', border: '1px solid rgba(var(--brand-rgb), 0.25)', borderRadius: '16px', padding: '0.75rem 1rem' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>نوع الطلب الحالي:</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)' }} id="cart-order-type">
              {orderType === 'DINE_IN' && table ? `داخل الفرع • ${table.tableLabel}` : ORDER_TYPE_LABELS[orderType]}
            </span>
          </div>
          {orderType !== 'DINE_IN' && (
            <button
              type="button"
              style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', background: 'rgba(var(--brand-deep-rgb), 0.15)', padding: '0.3rem 0.75rem', borderRadius: '9999px', border: '1px solid rgba(var(--brand-deep-rgb), 0.3)' }}
              onClick={() => setActiveTab('home')}
            >
              تغيير
            </button>
          )}
        </div>

        {/* ITEMS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800 }}>الأصناف في السلة ({itemCount}):</h2>
            <button type="button" style={{ fontSize: '12px', color: '#E57373', fontWeight: 600 }} onClick={clear}>
              مسح السلة
            </button>
          </div>

          {reconciled.map(({ line, issue, estimatedCents }) => {
            const product = index?.productsById.get(line.productId);
            const optionNames = product
              ? line.modifierOptionIds.map((id) => findOption(product, id)?.option.name).filter(Boolean).join(' • ')
              : '';
            return (
              <div
                key={line.lineId}
                className={`cart-line ${issue ? 'has-issue' : ''}`}
                data-product-id={line.productId}
                style={{ background: 'var(--surface-container)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', boxShadow: 'var(--shadow-tier1)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--on-surface)' }}>{product?.name ?? 'صنف غير متوفر'}</h3>
                    {optionNames && (
                      <div style={{ marginTop: '0.35rem', fontSize: '11.5px', color: 'var(--primary)', background: 'rgba(var(--brand-deep-rgb), 0.12)', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-block' }}>
                        {optionNames}
                      </div>
                    )}
                    {issue && <p className="field-error" role="alert">{ISSUE_TEXT[issue]}</p>}
                  </div>
                  <button type="button" style={{ color: '#E57373', padding: '0.25rem' }} onClick={() => removeLine(line.lineId)} aria-label="حذف الصنف">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>{money(estimatedCents)}</span>
                  <div className="quantity-stepper" style={{ height: '2.25rem' }}>
                    <button className="stepper-btn" type="button" aria-label="تقليل الكمية" onClick={() => setQuantity(line.lineId, line.quantity - 1)}>
                      −
                    </button>
                    <span className="stepper-val">{line.quantity}</span>
                    <button
                      className="stepper-btn"
                      type="button"
                      aria-label="زيادة الكمية"
                      disabled={line.quantity >= MAX_QUANTITY_PER_LINE}
                      onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            style={{ background: 'transparent', border: '1px dashed rgba(var(--brand-deep-rgb), 0.35)', borderRadius: '12px', padding: '0.75rem', color: 'var(--primary)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', cursor: 'pointer' }}
            onClick={() => setActiveTab('menu')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            <span>إضافة أصناف أخرى من المنيو</span>
          </button>
        </div>

        {/* ORDER SUMMARY */}
        <div style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(var(--brand-rgb), 0.25)', borderRadius: '20px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>ملخص الطلب</h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '17px', fontWeight: 800, color: 'var(--primary)' }}>
            <span>الإجمالي التقديري:</span>
            <span id="cart-estimated-total">{money(estimatedTotalCents)}</span>
          </div>
          <p className="summary-note">
            الأسعار المعروضة من منيو الكافيه، والإجمالي النهائي يؤكده الكافيه عند استلام الطلب.
            {orderType === 'DELIVERY' && ' الإجمالي المعروض لا يشمل أي رسوم توصيل.'}
          </p>

          {!orderTypeEnabled && (
            <div className="inline-notice is-warning" role="status" id="cart-order-type-disabled">
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              <span>هذا النوع من الطلبات غير متاح في هذا المقهى حالياً.</span>
            </div>
          )}

          {hasIssues && (
            <div className="inline-notice is-error" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">error</span>
              <span>بعض الأصناف في السلة تحتاج للمراجعة قبل إتمام الطلب.</span>
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            disabled={hasIssues || estimatedTotalCents === null || !orderTypeEnabled}
            style={{ width: '100%', height: '3.25rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '14px' }}
            onClick={() => setActiveTab('checkout')}
          >
            <span>متابعة إتمام الطلب</span>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
      </div>
    </main>
  );
};
