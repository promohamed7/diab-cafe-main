import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../data/menuData';

export const CartPage: React.FC = () => {
  const {
    cart,
    cartCount,
    cartTotalCents,
    orderMode,
    tableNumber,
    updateCartItemQty,
    removeFromCart,
    clearCart,
    setActiveTab,
    openTableModal,
    user
  } = useStore();

  const [useLoyaltyDiscount, setUseLoyaltyDiscount] = useState(false);

  const deliveryFeeCents = orderMode === 'DELIVERY' ? 2500 : 0;
  const loyaltyDiscountCents = useLoyaltyDiscount && (user?.loyaltyPoints || 0) >= 500 ? 2000 : 0;
  const grandTotalCents = Math.max(0, cartTotalCents + deliveryFeeCents - loyaltyDiscountCents);

  if (cartCount === 0) {
    return (
      <main className="page-content">
        <div className="content-inner">
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div
              style={{
                width: '5rem',
                height: '5rem',
                borderRadius: '9999px',
                background: 'rgba(200, 150, 62, 0.12)',
                border: '1.5px solid rgba(200, 150, 62, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '38px' }}>shopping_bag</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>سلة المشتريات فارغة</h2>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', maxWidth: '24rem', lineHeight: 1.6 }}>
              لم تضف أي مشروبات أو بن محمص إلى سلتك بعد. تصفح المنيو الكامل واختر ما يعجبك لنحضره لك فوراً!
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.75rem 2rem', marginTop: '0.5rem' }}
              onClick={() => setActiveTab('menu')}
            >
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
        {/* Header & Order Mode info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-container-high)',
            border: '1px solid rgba(244, 189, 97, 0.25)',
            borderRadius: '16px',
            padding: '0.75rem 1rem'
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>نوع الطلب الحالي:</span>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)' }}>
              {orderMode === 'DINE_IN'
                ? `داخل الفرع • طاولة ${tableNumber}`
                : orderMode === 'PICKUP'
                ? 'استلام من الفرع (تيك أواي)'
                : 'توصيل دليفري'}
            </span>
          </div>
          <button
            type="button"
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'rgba(200, 150, 62, 0.15)',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              border: '1px solid rgba(200, 150, 62, 0.3)'
            }}
            onClick={() => {
              if (orderMode === 'DINE_IN') openTableModal();
              else setActiveTab('home');
            }}
          >
            تغيير
          </button>
        </div>

        {/* ITEMS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800 }}>الأصناف في السلة ({cartCount}):</h2>
            <button
              type="button"
              style={{ fontSize: '12px', color: '#E57373', fontWeight: 600 }}
              onClick={clearCart}
            >
              مسح السلة
            </button>
          </div>

          {cart.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--surface-container)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                boxShadow: 'var(--shadow-tier1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--on-surface)' }}>
                    {item.productName}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                    {item.productNameEn}
                  </span>
                  {item.modifiersSummary && (
                    <div
                      style={{
                        marginTop: '0.35rem',
                        fontSize: '11.5px',
                        color: 'var(--primary)',
                        background: 'rgba(200, 150, 62, 0.12)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        display: 'inline-block'
                      }}
                    >
                      {item.modifiersSummary}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  style={{ color: '#E57373', padding: '0.25rem' }}
                  onClick={() => removeFromCart(item.id)}
                  aria-label="حذف الصنف"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatEGP(item.totalCents)}
                </span>

                {/* Quantity stepper */}
                <div className="quantity-stepper" style={{ height: '2.25rem' }}>
                  <button
                    className="stepper-btn"
                    type="button"
                    onClick={() => updateCartItemQty(item.id, -1)}
                  >
                    −
                  </button>
                  <span className="stepper-val">{item.quantity}</span>
                  <button
                    className="stepper-btn"
                    type="button"
                    onClick={() => updateCartItemQty(item.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            style={{
              background: 'transparent',
              border: '1px dashed rgba(200, 150, 62, 0.35)',
              borderRadius: '12px',
              padding: '0.75rem',
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('menu')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            <span>إضافة مشروبات أو بن إضافي من المنيو</span>
          </button>
        </div>

        {/* ORDER SUMMARY */}
        <div
          style={{
            background: 'var(--surface-container-high)',
            border: '1px solid rgba(244, 189, 97, 0.25)',
            borderRadius: '20px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
            ملخص الحساب
          </h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--on-surface-variant)' }}>المجموع الفرعي:</span>
            <span style={{ fontWeight: 700 }}>{formatEGP(cartTotalCents)}</span>
          </div>

          {orderMode === 'DELIVERY' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>رسوم التوصيل (سيدي سالم):</span>
              <span style={{ fontWeight: 700 }}>{formatEGP(deliveryFeeCents)}</span>
            </div>
          )}

          {/* Loyalty points toggle */}
          {user && user.loyaltyPoints >= 500 && (
            <div
              style={{
                background: 'rgba(200,150,62,0.1)',
                padding: '0.65rem 0.85rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, display: 'block' }}>استبدال نقاط الولاء</span>
                <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  رصيدك: {user.loyaltyPoints} نقطة (خصم ٢٠ ج.م)
                </span>
              </div>
              <button
                type="button"
                className={`btn-secondary ${useLoyaltyDiscount ? 'is-active' : ''}`}
                style={{
                  height: '2rem',
                  fontSize: '11.5px',
                  padding: '0 0.75rem',
                  borderColor: useLoyaltyDiscount ? 'var(--primary)' : 'rgba(255,255,255,0.2)'
                }}
                onClick={() => setUseLoyaltyDiscount(!useLoyaltyDiscount)}
              >
                {useLoyaltyDiscount ? 'تم التطبيق ✓' : 'تطبيق الخصم'}
              </button>
            </div>
          )}

          {loyaltyDiscountCents > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#81C784' }}>
              <span>خصم نقاط الولاء:</span>
              <span>- {formatEGP(loyaltyDiscountCents)}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '17px',
              fontWeight: 800,
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--primary)'
            }}
          >
            <span>الإجمالي النهائي:</span>
            <span>{formatEGP(grandTotalCents)}</span>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', height: '3.25rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '14px' }}
            onClick={() => setActiveTab('checkout' as any)}
          >
            <span>متابعة إتمام الطلب</span>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
      </div>
    </main>
  );
};
