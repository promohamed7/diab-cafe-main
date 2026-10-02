import React from 'react';
import { useUI } from '../context/UIContext';
import type { NavigationTab } from '../context/UIContext';
import { useCart } from '../hooks/useCart';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useUI();
  const { itemCount: cartCount } = useCart();

  const navItems: { tab: NavigationTab; label: string; icon: string; id: string }[] = [
    { tab: 'home', label: 'نوع الطلب', icon: 'room_service', id: 'nav-mode' },
    { tab: 'menu', label: 'المنيو', icon: 'local_cafe', id: 'nav-menu' },
    { tab: 'cart', label: 'السلة', icon: 'shopping_bag', id: 'nav-cart' },
    { tab: 'order', label: 'تتبع الطلب', icon: 'near_me', id: 'nav-track' },
    { tab: 'heritage', label: 'تراث دياب', icon: 'auto_awesome', id: 'nav-heritage' },
  ];

  return (
    <nav className="bottom-nav" id="bottom-nav" aria-label="التنقل الرئيسي">
      <div className="nav-inner">
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              className={`nav-item ${isActive ? 'is-active' : ''}`}
              id={item.id}
              onClick={() => setActiveTab(item.tab)}
              type="button"
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  className={`material-symbols-outlined ${isActive ? 'icon-filled' : ''}`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.tab === 'cart' && cartCount > 0 && (
                  <span className="nav-cart-badge" id="nav-cart-count" style={{ display: 'flex' }}>
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
