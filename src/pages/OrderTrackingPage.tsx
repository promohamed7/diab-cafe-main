import React from 'react';
import { useStore } from '../context/StoreContext';
import { formatEGP } from '../data/menuData';

export const OrderTrackingPage: React.FC = () => {
  const { activeOrder, updateOrderStatus, setActiveTab, orders } = useStore();

  const currentOrder = activeOrder || (orders.length > 0 ? orders[0] : null);

  if (!currentOrder) {
    return (
      <main className="page-content">
        <div className="content-inner">
          <div className="empty-state-card" style={{ display: 'flex' }}>
            <div className="empty-state-icon">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <h2 style={{ fontFamily: 'var(--ff-arabic)', fontSize: '18px', color: 'var(--on-surface)' }}>
              لا يوجد طلب نشط حالياً
            </h2>
            <p style={{ fontFamily: 'var(--ff-arabic)', fontSize: '13px', color: 'var(--on-surface-variant)', maxWidth: '20rem' }}>
              لم تقم بإرسال أي طلب حتى الآن، أو أن طلبك السابق قد تم تسليمه بالكامل. تفضل بطلب قهوتك المفضلة وسنبدأ في تجهيزها فوراً.
            </p>
            <button
              onClick={() => setActiveTab('menu')}
              className="btn-primary"
              style={{ textDecoration: 'none', marginTop: '0.5rem' }}
              type="button"
            >
              <span>ابدأ طلباً جديداً من المنيو</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>local_cafe</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const status = currentOrder.orderStatus;

  // Step indices: 0: PENDING, 1: ACCEPTED, 2: PREPARING, 3: READY, 4: COMPLETED
  let currentStepIndex = 0;
  if (status === 'PENDING') currentStepIndex = 0;
  else if (status === 'PREPARING') currentStepIndex = 2;
  else if (status === 'READY') currentStepIndex = 3;
  else if (status === 'COMPLETED') currentStepIndex = 4;
  else if (status === 'CANCELLED') currentStepIndex = -1;

  const modeLabel =
    currentOrder.orderType === 'DINE_IN'
      ? `طلب داخل الكافيه — طاولة ${currentOrder.tableNumber || '04'}`
      : currentOrder.orderType === 'PICKUP'
      ? 'استلام تيك أواي من الفرع'
      : 'توصيل ديليفري للمنزل';

  return (
    <main className="page-content">
      <div className="content-inner">
        <h1 className="sr-only">تتبع حالة الطلب المباشرة — دياب كافيه</h1>

        <div className="order-tracking-grid">
          {/* MAIN COLUMN: Status Stepper & Progress Tracking */}
          <div className="order-tracking-main-col">
            {/* 1. Header Meta Card */}
            <section className="tracking-header-card" aria-label="بيانات الطلب">
              <div className="tracking-top-meta">
                <span className="tracking-order-number" id="track-order-number">
                  {currentOrder.orderNumber}
                </span>

                <div
                  className={`tracking-status-pill ${
                    status === 'CANCELLED'
                      ? 'status-pill--rejected'
                      : status === 'COMPLETED'
                      ? 'status-pill--completed'
                      : 'status-pill--pending'
                  }`}
                  id="track-status-pill"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {status === 'COMPLETED'
                      ? 'check_circle'
                      : status === 'CANCELLED'
                      ? 'cancel'
                      : 'hourglass_top'}
                  </span>
                  <span>
                    {status === 'PENDING' && 'قيد المراجعة'}
                    {status === 'PREPARING' && 'جاري التحضير'}
                    {status === 'READY' && 'جاهز للاستلام'}
                    {status === 'COMPLETED' && 'تم التسليم بنجاح'}
                    {status === 'CANCELLED' && 'تم إلغاء الطلب'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--ff-arabic)',
                  fontSize: '12px',
                  color: 'var(--on-surface-variant)',
                  marginTop: '0.4rem'
                }}
              >
                <span id="track-mode-badge" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {modeLabel}
                </span>
                <span id="track-order-date">
                  {new Date(currentOrder.createdAt).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Rejection Alert Box */}
              {status === 'CANCELLED' && (
                <div
                  id="track-rejection-alert"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    background: 'rgba(255, 180, 171, 0.1)',
                    border: '1px solid var(--error)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem',
                    color: 'var(--error)',
                    marginTop: '0.75rem'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>
                    error
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--ff-arabic)', fontSize: '12px' }}>
                    <strong>نعتذر عن عدم قبول الطلب:</strong>
                    <span id="track-rejection-msg" style={{ marginTop: '0.2rem' }}>
                      {currentOrder.rejectionReason || 'نفاد كمية الصنف أو انتهاء ساعات العمل'}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* 2. Animated Status Stepper */}
            <section className="tracking-stepper-box" aria-label="مراحل تجهيز الطلب">
              {/* Step 1: PENDING */}
              <div
                className={`stepper-step-item ${currentStepIndex >= 0 ? 'is-active' : ''} ${
                  currentStepIndex > 0 ? 'is-completed' : ''
                }`}
                id="step-pending"
              >
                <div className="step-marker-circle">١</div>
                <div className="step-content-text">
                  <span className="step-title">تم استلام الطلب (قيد المراجعة)</span>
                  <span className="step-desc">وصل طلبك لشاشة الكاشير لمطابقة تفاصيل الحساب والتجهيز</span>
                </div>
              </div>

              {/* Step 2: ACCEPTED / CONFIRMED */}
              <div
                className={`stepper-step-item ${currentStepIndex >= 1 ? 'is-active' : ''} ${
                  currentStepIndex > 1 ? 'is-completed' : ''
                }`}
                id="step-accepted"
              >
                <div className="step-marker-circle">٢</div>
                <div className="step-content-text">
                  <span className="step-title">تم قبول الطلب (طباعة التذكرة)</span>
                  <span className="step-desc">تم اعتماد الحساب، طبع بون التحضير للباريستا وخصم المكونات</span>
                </div>
              </div>

              {/* Step 3: PREPARING */}
              <div
                className={`stepper-step-item ${currentStepIndex >= 2 ? 'is-active' : ''} ${
                  currentStepIndex > 2 ? 'is-completed' : ''
                }`}
                id="step-preparing"
              >
                <div className="step-marker-circle">٣</div>
                <div className="step-content-text">
                  <span className="step-title">الباريستا يحضر مشروباتك بعناية</span>
                  <span className="step-desc">استخلاص الإسبريسو، تبخير الحليب، وطحن حبوب البن الطازجة</span>
                </div>
              </div>

              {/* Step 4: READY */}
              <div
                className={`stepper-step-item ${currentStepIndex >= 3 ? 'is-active' : ''} ${
                  currentStepIndex > 3 ? 'is-completed' : ''
                }`}
                id="step-ready"
              >
                <div className="step-marker-circle">٤</div>
                <div className="step-content-text">
                  <span className="step-title">جاهز للاستلام / مع المندوب</span>
                  <span className="step-desc">مشروبك جاهز على البار أو انطلق كابتن التوصيل لموقعك</span>
                </div>
              </div>

              {/* Step 5: COMPLETED */}
              <div
                className={`stepper-step-item ${currentStepIndex >= 4 ? 'is-active' : ''} ${
                  currentStepIndex === 4 ? 'is-completed' : ''
                }`}
                id="step-completed"
              >
                <div className="step-marker-circle">٥</div>
                <div className="step-content-text">
                  <span className="step-title">تم التسليم بنجاح</span>
                  <span className="step-desc">نتمنى لك تجربة ممتعة وننتظر زيارتك القادمة دائماً</span>
                </div>
              </div>
            </section>
          </div>

          {/* SIDEBAR COLUMN: Receipt, Simulator & Actions */}
          <aside className="order-tracking-side-col">
            {/* Itemized Order Receipt */}
            <section className="checkout-section-card" aria-label="فاتورة الطلب">
              <div className="checkout-section-title">
                <span className="material-symbols-outlined">receipt</span>
                <span>تفاصيل الأصناف والخيارات المحددة</span>
              </div>

              <div id="track-receipt-items">
                {currentOrder.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '0.65rem 0',
                      borderBottom: '1px solid rgba(244, 189, 97, 0.12)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--on-surface)' }}>
                        {item.quantity} × {item.productName}
                      </div>
                      {item.modifiersSummary && (
                        <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '0.15rem' }}>
                          {item.modifiersSummary}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', flexShrink: 0 }}>
                      {formatEGP(item.totalCents)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  borderTop: '1px dashed rgba(200, 150, 62, 0.2)',
                  paddingTop: '0.65rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div className="summary-row">
                  <span>المجموع الفرعي:</span>
                  <span style={{ fontWeight: 700, color: 'var(--on-surface)' }}>
                    {formatEGP(currentOrder.subtotalCents)}
                  </span>
                </div>

                {currentOrder.deliveryFeeCents > 0 && (
                  <div className="summary-row">
                    <span>رسوم التوصيل:</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {formatEGP(currentOrder.deliveryFeeCents)}
                    </span>
                  </div>
                )}

                {currentOrder.loyaltyDiscountCents > 0 && (
                  <div className="summary-row loyalty-discount-row">
                    <span>خصم نقاط الولاء:</span>
                    <span style={{ fontWeight: 700, color: '#4caf50' }}>
                      -{formatEGP(currentOrder.loyaltyDiscountCents)}
                    </span>
                  </div>
                )}

                <div className="summary-row total-row">
                  <span>الإجمالي:</span>
                  <span>{formatEGP(currentOrder.authoritativeTotalCents)}</span>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-container-high)',
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--ff-arabic)',
                  fontSize: '11px',
                  color: 'var(--on-surface-variant)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '0.5rem'
                }}
              >
                <span>حالة السداد:</span>
                <strong style={{ color: 'var(--primary)' }}>
                  {currentOrder.paymentMethod === 'CASH'
                    ? 'الدفع كاش عند الاستلام'
                    : currentOrder.paymentMethod === 'VODAFONE_CASH'
                    ? 'فودافون كاش / إنستاباي'
                    : 'بطاقة بنكية'}
                </strong>
              </div>
            </section>

            {/* Interactive Barista Simulation Controls */}
            <section className="simulation-bar" aria-label="محاكاة مسار الباريستا">
              <div className="sim-label">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>terminal</span>
                <span>أدوات محاكاة شاشة الكاشير والباريستا (QA & Review)</span>
              </div>
              <div className="sim-buttons">
                <button
                  className="sim-btn"
                  type="button"
                  onClick={() => updateOrderStatus(currentOrder.orderId, 'PENDING')}
                >
                  ١. استلام (Pending)
                </button>
                <button
                  className="sim-btn"
                  type="button"
                  onClick={() => updateOrderStatus(currentOrder.orderId, 'PREPARING')}
                >
                  ٢. قبول وتحضير (Preparing)
                </button>
                <button
                  className="sim-btn"
                  type="button"
                  onClick={() => updateOrderStatus(currentOrder.orderId, 'READY')}
                >
                  ٣. جاهز (Ready)
                </button>
                <button
                  className="sim-btn"
                  type="button"
                  onClick={() => updateOrderStatus(currentOrder.orderId, 'COMPLETED')}
                >
                  ٤. تسليم (Completed)
                </button>
                <button
                  className="sim-btn"
                  type="button"
                  style={{ color: 'var(--error)' }}
                  onClick={() => updateOrderStatus(currentOrder.orderId, 'CANCELLED')}
                >
                  إلغاء الطلب
                </button>
              </div>
            </section>

            {/* Direct Support & Hotline Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <a
                href="tel:01012345678"
                className="btn-secondary"
                style={{ textDecoration: 'none', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>call</span>
                <span>اتصال بالكافيه</span>
              </a>
              <a
                href="https://wa.me/201012345678"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat</span>
                <span>واتساب الفرع</span>
              </a>
            </div>

            <button
              onClick={() => setActiveTab('menu')}
              className="btn-primary"
              style={{ textDecoration: 'none', justifyContent: 'center', height: '3.25rem', width: '100%' }}
              type="button"
            >
              <span>طلب صنف آخر من المنيو</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_circle</span>
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
};
