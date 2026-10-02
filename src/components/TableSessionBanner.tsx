import React from 'react';
import { useOrderContext } from '../hooks/useOrderContext';

/**
 * Shows the dine-in table that Café resolved from the QR code, or why a scanned
 * code could not be used. There is no way to pick or edit a table here.
 */
export const TableSessionBanner: React.FC = () => {
  const { table, tableStatus, leaveTable, retryTableResolution } = useOrderContext();

  if (tableStatus === 'resolving') {
    return (
      <div className="table-session-banner" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>
        <span>جارٍ التحقق من كود الطاولة مع الكافيه...</span>
      </div>
    );
  }

  if (tableStatus === 'disabled') {
    return (
      <div className="table-session-banner is-error" role="alert">
        <span className="material-symbols-outlined" aria-hidden="true">table_restaurant</span>
        <span>الطلب من الطاولة غير متاح في هذا المقهى. يمكنك تصفح المنيو.</span>
      </div>
    );
  }

  if (tableStatus === 'invalid') {
    return (
      <div className="table-session-banner is-error" role="alert">
        <span className="material-symbols-outlined" aria-hidden="true">error</span>
        <span>كود الطاولة غير صالح لهذا المقهى أو منتهي. امسح الكود الموجود على طاولتك مرة أخرى.</span>
      </div>
    );
  }

  if (tableStatus === 'unverified') {
    return (
      <div className="table-session-banner is-error" role="alert">
        <span className="material-symbols-outlined" aria-hidden="true">wifi_off</span>
        <span>تعذر التحقق من كود الطاولة الآن.</span>
        <button type="button" className="table-session-action" onClick={retryTableResolution}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (tableStatus === 'active' && table) {
    return (
      <div className="table-session-banner is-active" role="status" id="table-session-banner">
        <span className="material-symbols-outlined" aria-hidden="true">table_restaurant</span>
        <span>
          تطلب الآن من <strong id="table-session-label">{table.tableLabel}</strong>
        </span>
        <button type="button" className="table-session-action" onClick={leaveTable}>
          إنهاء طلب الطاولة
        </button>
      </div>
    );
  }

  return null;
};
