import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    user,
    loginUser,
    logoutUser,
    addSavedAddress,
    deleteSavedAddress,
    setDefaultAddress,
    orderUsual,
    showToast
  } = useStore();

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [phone, setPhone] = useState('01012345678');
  const [name, setName] = useState('أحمد محمود');
  const [otpCode, setOtpCode] = useState(['1', '4', '5', '0']);

  // Add Address Form
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrCity, setAddrCity] = useState('سيدي سالم — وسط البلد');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrBldg, setAddrBldg] = useState('');

  if (!isAuthModalOpen) return null;

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      showToast('يرجى إدخال رقم هاتف مصري صحيح');
      return;
    }
    setStep('otp');
  };

  const handleConfirmOtp = () => {
    loginUser(name || 'أحمد محمود', phone || '01012345678');
    setStep('form');
    closeAuthModal();
  };

  const handleInstantDemo = () => {
    loginUser('أحمد محمود', '01012345678');
    setStep('form');
    closeAuthModal();
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet) {
      showToast('يرجى إدخال اسم الشارع');
      return;
    }
    addSavedAddress({
      label: addrLabel || 'عنوان جديد',
      city: addrCity,
      street: addrStreet,
      building: addrBldg,
      isDefault: (user?.savedAddresses.length || 0) === 0
    });
    setAddrLabel('');
    setAddrStreet('');
    setAddrBldg('');
    setShowAddAddress(false);
  };

  const handleReorderUsual = () => {
    orderUsual();
    closeAuthModal();
    showToast('تمت إضافة طلبك المعتاد إلى السلة!');
  };

  return (
    <div
      className={`modal-overlay auth-modal-overlay ${isAuthModalOpen ? 'is-open' : ''}`}
      id="auth-modal"
      role="dialog"
      aria-modal="true"
      style={{
        display: isAuthModalOpen ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 2100,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div
        className="auth-modal-card animate-entrance"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(22, 19, 17, 0.98)',
          border: '1px solid rgba(244, 189, 97, 0.35)',
          borderRadius: '24px',
          padding: '1.5rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn auth-modal-close"
          aria-label="إغلاق"
          style={{ position: 'absolute', top: '1.25rem', left: '1.25rem' }}
          onClick={closeAuthModal}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
        </button>

        {user ? (
          /* LOGGED IN USER PROFILE */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '3.25rem',
                  height: '3.25rem',
                  borderRadius: '9999px',
                  background: 'rgba(200, 150, 62, 0.15)',
                  border: '1.5px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>person</span>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>{user.name}</h3>
                <span style={{ fontSize: '12.5px', color: 'var(--on-surface-variant)' }}>{user.phone}</span>
              </div>
            </div>

            {/* Loyalty points card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(200, 150, 62, 0.2), rgba(30, 24, 20, 0.9))',
                border: '1px solid rgba(244, 189, 97, 0.3)',
                borderRadius: '16px',
                padding: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '11.5px', color: 'var(--on-surface-variant)', display: 'block' }}>رصيد نقاط الولاء:</span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>
                  {user.loyaltyPoints} <span style={{ fontSize: '13px' }}>نقطة</span>
                </span>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>
                stars
              </span>
            </div>

            {/* Re-order Usual Button */}
            {user.usualOrder && (
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-primary auth-reorder-btn"
                  style={{ width: '100%', height: '2.85rem', fontSize: '13px', justifyContent: 'center' }}
                  onClick={handleReorderUsual}
                >
                  <span className="material-symbols-outlined">bolt</span>
                  <span>طلب قهوتك المعتادة (Re-Order)</span>
                </button>
              </div>
            )}

            {/* Saved Addresses */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700 }}>العناوين المسجلة:</h4>
                <button
                  type="button"
                  style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}
                  onClick={() => setShowAddAddress(!showAddAddress)}
                >
                  {showAddAddress ? 'إلغاء' : '+ إضافة عنوان'}
                </button>
              </div>

              {showAddAddress && (
                <form
                  onSubmit={handleSaveAddress}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <input
                    type="text"
                    className="checkout-input"
                    placeholder="اسم المكان (مثال: المنزل / المكتب)"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    style={{ height: '2.4rem', fontSize: '12.5px' }}
                  />
                  <input
                    type="text"
                    className="checkout-input"
                    placeholder="المدينة / المنطقة"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    style={{ height: '2.4rem', fontSize: '12.5px' }}
                  />
                  <input
                    type="text"
                    className="checkout-input"
                    placeholder="اسم الشارع والمعالم المميزة"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    style={{ height: '2.4rem', fontSize: '12.5px' }}
                    required
                  />
                  <input
                    type="text"
                    className="checkout-input"
                    placeholder="رقم العمارة / الطابق / الشقة"
                    value={addrBldg}
                    onChange={(e) => setAddrBldg(e.target.value)}
                    style={{ height: '2.4rem', fontSize: '12.5px' }}
                  />
                  <button type="submit" className="btn-primary" style={{ height: '2.5rem', justifyContent: 'center', fontSize: '13px' }}>
                    حفظ العنوان
                  </button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {user.savedAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      border: addr.isDefault ? '1px solid rgba(200, 150, 62, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{addr.label}</span>
                        {addr.isDefault && (
                          <span style={{ fontSize: '10px', background: 'rgba(200,150,62,0.2)', color: 'var(--primary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            افتراضي
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                        {addr.city} — {addr.street} {addr.building ? `— ${addr.building}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {!addr.isDefault && (
                        <button
                          type="button"
                          style={{ fontSize: '11px', color: 'var(--primary)', padding: '0.25rem 0.5rem' }}
                          onClick={() => setDefaultAddress(addr.id)}
                        >
                          تعيين
                        </button>
                      )}
                      <button
                        type="button"
                        style={{ color: '#E57373', padding: '0.25rem 0.5rem' }}
                        onClick={() => deleteSavedAddress(addr.id)}
                        aria-label="حذف العنوان"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logout button */}
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', height: '2.6rem', fontSize: '12.5px', justifyContent: 'center', color: '#E57373', borderColor: 'rgba(229, 115, 115, 0.3)' }}
              onClick={logoutUser}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : step === 'form' ? (
          /* LOGIN FORM */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  margin: '0 auto 0.75rem auto',
                  borderRadius: '9999px',
                  background: 'rgba(200, 150, 62, 0.15)',
                  border: '1px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>login</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>تسجيل الدخول / إنشاء حساب</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                ادخل رقم هاتفك لحفظ عناوينك ونقاط الولاء وإعادة طلب قهوتك المعتادة بضغطة زر.
              </p>
            </div>

            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>الاسم الكريم</label>
                <input
                  type="text"
                  className="checkout-input"
                  placeholder="مثال: أحمد محمود"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>رقم الهاتف المحمول</label>
                <input
                  type="tel"
                  className="checkout-input"
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', direction: 'ltr', textAlign: 'right' }}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', height: '2.85rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                <span>طلب رمز التأكيد (OTP)</span>
                <span className="material-symbols-outlined">send</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', height: '2.5rem', justifyContent: 'center', fontSize: '12.5px', borderColor: 'rgba(200,150,62,0.3)' }}
                onClick={handleInstantDemo}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>
                <span>تسجيل دخول فوري تجريبي</span>
              </button>
            </form>
          </div>
        ) : (
          /* OTP VERIFICATION STEP */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  margin: '0 auto 0.75rem auto',
                  borderRadius: '9999px',
                  background: 'rgba(200, 150, 62, 0.15)',
                  border: '1px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>lock</span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>تأكيد رمز التحقق (OTP)</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                تم إرسال كود التحقق المكون من 4 أرقام إلى الهاتف {phone}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', marginBottom: '1.25rem', direction: 'ltr' }}>
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const newOtp = [...otpCode];
                    newOtp[i] = e.target.value;
                    setOtpCode(newOtp);
                  }}
                  style={{
                    width: '3.2rem',
                    height: '3.2rem',
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: 800,
                    borderRadius: '12px',
                    background: 'var(--surface-container-high)',
                    border: '1.5px solid var(--primary)',
                    color: 'var(--primary)'
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', height: '2.85rem', justifyContent: 'center' }}
              onClick={handleConfirmOtp}
            >
              <span>تأكيد ومتابعة الدخول</span>
              <span className="material-symbols-outlined">done</span>
            </button>

            <button
              type="button"
              style={{ width: '100%', textAlign: 'center', marginTop: '0.85rem', fontSize: '12px', color: 'var(--on-surface-variant)' }}
              onClick={() => setStep('form')}
            >
              تغيير رقم الهاتف
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
