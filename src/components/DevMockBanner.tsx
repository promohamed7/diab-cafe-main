import React, { useEffect, useState } from 'react';
import { getTransportKind } from '../integration';
import type { TransportKind } from '../integration/transport';

/** Makes it impossible to mistake the development mock for the real café. */
export const DevMockBanner: React.FC = () => {
  const [kind, setKind] = useState<TransportKind | null>(null);

  useEffect(() => {
    let active = true;
    void getTransportKind().then((k) => {
      if (active) setKind(k);
    });
    return () => {
      active = false;
    };
  }, []);

  if (kind !== 'mock') return null;
  return (
    <div className="dev-mock-banner" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">science</span>
      <span>بيئة تطوير: منيو وطلبات تجريبية — لا تصل الطلبات إلى الكافيه</span>
    </div>
  );
};
