import React, { useEffect, useState } from 'react';
import { useUI } from '../context/UIContext';

const TONE_ICON = { success: 'check_circle', error: 'error', info: 'info' } as const;

export const Toast: React.FC = () => {
  const { toast } = useUI();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), toast.tone === 'error' ? 4200 : 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={`site-toast ${visible ? 'is-visible' : ''}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      style={{
        position: 'fixed',
        bottom: '5.5rem',
        left: '50%',
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 2200,
        background: 'rgba(26, 21, 18, 0.96)',
        color: '#F4EDE4',
        border: `1px solid ${toast.tone === 'error' ? 'rgba(255, 180, 171, 0.55)' : 'rgba(var(--brand-rgb), 0.35)'}`,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
        borderRadius: '9999px',
        padding: '0.65rem 1.25rem',
        fontSize: '13.5px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        maxWidth: 'calc(100% - 2rem)',
        textAlign: 'center'
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ color: toast.tone === 'error' ? 'var(--error)' : 'var(--primary)', fontSize: '18px' }}
      >
        {TONE_ICON[toast.tone]}
      </span>
      <span>{toast.text}</span>
    </div>
  );
};
