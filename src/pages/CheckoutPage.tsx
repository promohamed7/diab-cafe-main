import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../data/menuData';

export const CheckoutPage: React.FC = () => {
  const {
    orderMode,
    tableNumber,
    cart,
    cartTotalCents,
    user,
    submitOrder,
    setActiveTab,
    openTableModal,
    showToast
  } = useStore();

  const [fullName, setFullName] = useState(user?.name || 'أحمد محمود');
  const [phone, setPhone] = useState(user?.phone || '01012345678');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VODAFONE_CASH' | 'CARD'>('CASH');

  // Delivery address
  const defaultAddr = user?.savedAddresses?.find((a) => a.isDefault) || user?.savedAddresses?.[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string>(defaultAddr?.id || 'manual');
  const [manualAddress, setManualAddress] = useState(
    defaultAddr ? `${defaultAddr.city} — ${defaultAddr.street} ${defaultAddr.building || ''}` : ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const deliveryFeeCents = orderMode === 'DELIVERY' ? 2500 : 0;
  const grandTotalCents = cartTotalCents + deliveryFeeCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('يرجى إدخال اسم العميل');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      showToast('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    let finalAddress = '';
    if (orderMode === 'DELIVERY') {
      if (selectedAddressId !== 'manual') {
        const found = user?.savedAddresses?.find((a) => a.id === selectedAddressId);
        finalAddress = found ? `${found.city} — ${found.street} ${found.building || ''}` : manualAddress;
      } else {
        finalAddress = manualAddress;
      }
      if (!finalAddress.trim()) {
        showToast('يرجى تحديد أو إدخال عنوان التوصيل');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await submitOrder({
        fullName,
        phone,
        deliveryAddress: orderMode === 'DELIVERY' ? finalAddress : undefined,
        customerNotes: notes,
        paymentMethod
      });
      setActiveTab('order');
    } catch {
      showToast('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-content" style={{ paddingBottom: '6rem' }}>
      <div className="content-inner">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800 }}>إتمام وتأكيد الطلب</h1>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
              أدخل بياناتك لتأكيد طلبك وتوجيهه للباريستا فوراً
            </p>
          </div>
          <button
            type="button"
            style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}
            onClick={() => setActiveTab('cart')}
          >
            ← العودة للسلة
          </button>
        </div>

        {/* Order Mode Info */}
        <div
          style={{
            background: 'var(--surface-container-high)',
            border: '1px solid rgba(244, 189, 97, 0.25)',
            borderRadius: '16px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '22px' }}>
              {orderMode === 'DINE_IN' ? 'table_restaurant' : orderMode === 'PICKUP' ? 'store' : 'two_wheeler'}
            </span>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: 700 }}>
                {orderMode === 'DINE_IN'
                  ? `طلب داخل الفرع — طاولة ${tableNumber}`
                  : orderMode === 'PICKUP'
                  ? 'استلام سريع من الفرع (تيك أواي)'
                  : 'توصيل دليفري منزلي'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>
                {orderMode === 'DINE_IN'
                  ? 'يصل الطلب لطاولتك مع الباريستا'
                  : orderMode === 'PICKUP'
                  ? 'جاهز للاستلام خلال 10-15 دقيقة'
                  : 'تغطية سيدي سالم وكفر الشيخ خلال 25-35 دقيقة'}
              </span>
            </div>
          </div>
          {orderMode === 'DINE_IN' && (
            <button
              type="button"
              style={{
                fontSize: '11.5px',
                color: 'var(--primary)',
                fontWeight: 700,
                background: 'rgba(200,150,62,0.15)',
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid rgba(200,150,62,0.3)'
              }}
              onClick={openTableModal}
            >
              تغيير الطاولة
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Customer Details Box */}
          <div
            style={{
              background: 'var(--surface-container)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--on-surface)' }}>بيانات العميل:</h3>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                الاسم بالكامل *
              </label>
              <input
                type="text"
                className="checkout-input"
                placeholder="أحمد محمود"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                رقم الهاتف المحمول للتأكيد والمتابعة *
              </label>
              <input
                type="tel"
                className="checkout-input"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{ width: '100%', direction: 'ltr', textAlign: 'right' }}
              />
            </div>

            {/* Delivery address selector if mode is DELIVERY */}
            {orderMode === 'DELIVERY' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                  عنوان التوصيل في سيدي سالم أو كفر الشيخ *
                </label>

                {user?.savedAddresses && user.savedAddresses.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {user.savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          background: selectedAddressId === addr.id ? 'rgba(200,150,62,0.15)' : 'rgba(255,255,255,0.02)',
                          border: selectedAddressId === addr.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '12px',
                          padding: '0.65rem 0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="radio"
                          name="addressGroup"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                        />
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{addr.label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', display: 'block' }}>
                            {addr.city} — {addr.street} {addr.building || ''}
                          </span>
                        </div>
                      </label>
                    ))}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        background: selectedAddressId === 'manual' ? 'rgba(200,150,62,0.15)' : 'rgba(255,255,255,0.02)',
                        border: selectedAddressId === 'manual' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '0.65rem 0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="radio"
                        name="addressGroup"
                        checked={selectedAddressId === 'manual'}
                        onChange={() => setSelectedAddressId('manual')}
                      />
                      <span style={{ fontSize: '12.5px', fontWeight: 600 }}>عنوان آخر جديد</span>
                    </label>
                  </div>
                )}

                {(selectedAddressId === 'manual' || !user?.savedAddresses?.length) && (
                  <textarea
                    className="checkout-input"
                    placeholder="مثال: سيدي سالم، شارع المحكمة، أمام بنك مصر، عمارة ٤ الدور الثاني"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    rows={2}
                    style={{ width: '100%', height: 'auto', padding: '0.65rem' }}
                    required={orderMode === 'DELIVERY'}
                  />
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                ملاحظات خاصة للباريستا أو الدليفري (اختياري)
              </label>
              <input
                type="text"
                className="checkout-input"
                placeholder="مثال: زيادة ثلج، تحميص غامق، السكر في كوب خارجي..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div
            style={{
              background: 'var(--surface-container)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>طريقة الدفع:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '14px',
                  background: paymentMethod === 'CASH' ? 'rgba(200,150,62,0.18)' : 'rgba(255,255,255,0.03)',
                  border: paymentMethod === 'CASH' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="payMethod"
                  checked={paymentMethod === 'CASH'}
                  onChange={() => setPaymentMethod('CASH')}
                />
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>payments</span>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, display: 'block' }}>
                    {orderMode === 'DELIVERY' ? 'كاش عند استلام الطلب' : 'كاش عند الكاشير / الطاولة'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>الدفع نقداً بعد استلام المشروبات</span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '14px',
                  background: paymentMethod === 'VODAFONE_CASH' ? 'rgba(200,150,62,0.18)' : 'rgba(255,255,255,0.03)',
                  border: paymentMethod === 'VODAFONE_CASH' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="payMethod"
                  checked={paymentMethod === 'VODAFONE_CASH'}
                  onChange={() => setPaymentMethod('VODAFONE_CASH')}
                />
                <span className="material-symbols-outlined" style={{ color: 'var(--secondary)' }}>phonelink_ring</span>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, display: 'block' }}>فودافون كاش أو إنستاباي (InstaPay)</span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>تحويل فوري لرقم كاشير دياب كافيه المعتمد</span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '14px',
                  background: paymentMethod === 'CARD' ? 'rgba(200,150,62,0.18)' : 'rgba(255,255,255,0.03)',
                  border: paymentMethod === 'CARD' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="payMethod"
                  checked={paymentMethod === 'CARD'}
                  onChange={() => setPaymentMethod('CARD')}
                />
                <span className="material-symbols-outlined" style={{ color: 'var(--tertiary)' }}>credit_card</span>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, display: 'block' }}>بطاقة بنكية / فيزا أو ماستركارد</span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>ماكينة نقاط البيع المحمولة POS</span>
                </div>
              </label>
            </div>
          </div>

          {/* Order Review List */}
          <div
            style={{
              background: 'var(--surface-container-high)',
              border: '1px solid rgba(244, 189, 97, 0.25)',
              borderRadius: '20px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
              مراجعة الأصناف ({cart.length}):
            </h3>
            {cart.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span>
                  {item.quantity}× {item.productName} {item.modifiersSummary ? `(${item.modifiersSummary})` : ''}
                </span>
                <span style={{ fontWeight: 700 }}>{formatEGP(item.totalCents)}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>المجموع الفرعي:</span>
              <span>{formatEGP(cartTotalCents)}</span>
            </div>

            {orderMode === 'DELIVERY' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>رسوم التوصيل:</span>
                <span>{formatEGP(deliveryFeeCents)}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '17px',
                fontWeight: 800,
                color: 'var(--primary)',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <span>المبلغ الإجمالي:</span>
              <span>{formatEGP(grandTotalCents)}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: '100%', height: '3.35rem', justifyContent: 'center', fontSize: '14.5px', marginTop: '0.5rem' }}
            >
              {isSubmitting ? (
                <span>جاري إرسال الطلب للخادم...</span>
              ) : (
                <>
                  <span>تأكيد وإرسال الطلب الآن</span>
                  <span className="material-symbols-outlined">send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
