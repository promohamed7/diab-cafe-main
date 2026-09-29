import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useStore();
  const [visible, setVisible] = useState(false);
  const [currentText, setCurrentText] = useState('');

  useEffect(() => {
    if (toastMessage) {
      setCurrentText(toastMessage);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!visible && !currentText) return null;

  return (
    <div
      className={`site-toast ${visible ? 'is-visible' : ''}`}
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
        border: '1px solid rgba(244, 189, 97, 0.35)',
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
      <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '18px' }}>
        check_circle
      </span>
      <span>{currentText}</span>
    </div>
  );
};
