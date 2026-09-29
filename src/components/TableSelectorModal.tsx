import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';

const TABLES = [
  { id: '1', label: '١', value: '01' },
  { id: '2', label: '٢', value: '02' },
  { id: '3', label: '٣', value: '03' },
  { id: '4', label: '٤', value: '04' },
  { id: '5', label: '٥', value: '05' },
  { id: '6', label: '٦', value: '06' },
  { id: 't1', label: 'تراس ١', value: 'تراس 1' },
  { id: 't2', label: 'تراس ٢', value: 'تراس 2' },
];

export const TableSelectorModal: React.FC = () => {
  const { isTableModalOpen, closeTableModal, setOrderMode, setActiveTab, showToast } = useStore();
  const [view, setView] = useState<'qr' | 'manual'>('qr');
  const [selectedTable, setSelectedTable] = useState('04');

  if (!isTableModalOpen) return null;

  const handleSimulateScan = () => {
    setOrderMode('DINE_IN', '04');
    closeTableModal();
    showToast('تم التحقق من طاولة ٤ بنجاح!');
    setActiveTab('menu');
  };

  const handleConfirmManual = () => {
    setOrderMode('DINE_IN', selectedTable);
    closeTableModal();
    showToast(`تم اختيار طاولة ${selectedTable} بنجاح!`);
    setActiveTab('menu');
  };

  return (
    <div
      className={`drawer-overlay ${isTableModalOpen ? 'is-open' : ''}`}
      id="table-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="مسح كود الطاولة أو تحديدها"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeTableModal();
      }}
    >
      <div className="drawer-panel qr-flow-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-head">
          <div className="drawer-head-info">
            <div className="drawer-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>qr_code_scanner</span>
            </div>
            <div className="drawer-head-text">
              <h3 id="table-drawer-title">
                {view === 'qr' ? 'امسح كود QR على طاولتك' : 'تحديد رقم الطاولة'}
              </h3>
              <p id="table-drawer-desc">
                {view === 'qr'
                  ? 'وجه كاميرا هاتفك نحو اللوحة النحاسية المثبتة أمامك'
                  : 'اختر رقم طاولتك من القائمة أدناه'}
              </p>
            </div>
          </div>
          <button className="drawer-close-btn" id="drawer-close" aria-label="إغلاق" onClick={closeTableModal}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* VIEW 1: QR Scanner */}
        {view === 'qr' && (
          <div className="qr-scanner-view" id="qr-scanner-view">
            <div className="qr-viewfinder" id="qr-viewfinder">
              <div className="qr-scanner-frame">
                <div className="scanner-corner corner-tl"></div>
                <div className="scanner-corner corner-tr"></div>
                <div className="scanner-corner corner-bl"></div>
                <div className="scanner-corner corner-br"></div>
                <div className="scanner-laser-line"></div>
                <div className="qr-table-badge">
                  <span className="material-symbols-outlined">table_restaurant</span>
                  <span id="detected-table-label">كود الطاولة</span>
                </div>
              </div>
              <p className="qr-hint-text">جاري البحث عن كود الطاولة عبر الكاميرا...</p>
            </div>

            <div className="qr-scanner-actions">
              <button
                className="btn-primary qr-scan-action-btn"
                id="drawer-simulate-scan"
                type="button"
                onClick={handleSimulateScan}
              >
                <span className="material-symbols-outlined">qr_code_2</span>
                <span>مسح الكود الآن</span>
              </button>
              <button
                className="qr-manual-fallback-btn"
                id="btn-show-manual-tables"
                type="button"
                onClick={() => setView('manual')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dialpad</span>
                <span>تعذر المسح؟ أدخل رقم الطاولة يدوياً</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: Manual Grid */}
        {view === 'manual' && (
          <div className="table-manual-view" id="table-manual-view">
            <div className="manual-table-note">
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '18px' }}>info</span>
              <span>اختر رقم الطاولة المطبوع على اللوحة النحاسية:</span>
            </div>

            <div className="table-grid">
              {TABLES.map((tbl) => (
                <button
                  key={tbl.id}
                  className={`table-btn ${selectedTable === tbl.value ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedTable(tbl.value)}
                >
                  {tbl.label}
                </button>
              ))}
            </div>

            <div className="manual-actions">
              <button
                className="drawer-btn-back-qr"
                id="btn-back-to-qr"
                type="button"
                onClick={() => setView('qr')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                <span>العودة للمسح</span>
              </button>
              <button
                className="drawer-btn-confirm"
                id="drawer-confirm"
                type="button"
                onClick={handleConfirmManual}
              >
                <span>تأكيد المتابعة</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>done</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
