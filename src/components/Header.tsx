import React from 'react';
import { useStore } from '../context/StoreContext';

export const Header: React.FC = () => {
  const {
    cartCount,
    setActiveTab,
    toggleTheme,
    openAuthModal,
    activeTab,
    orderMode,
    tableNumber,
    openTableModal,
    toggleSearch,
    isHeroTitleDocked
  } = useStore();

  return (
    <header className="site-header" id="site-header">
      <div className="header-inner">
        {/* Right Side (RTL): Cart Button */}
        <div className="header-right-side">
          <button
            className="header-cart-btn"
            id="header-cart"
            aria-label="سلة المشتريات"
            onClick={() => setActiveTab('cart')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '21px' }}>shopping_bag</span>
            <span className="cart-badge" id="header-cart-count">{cartCount}</span>
          </button>
        </div>

        {/* Center: Brand Logo / Active Order Mode Badge */}
        <div className="header-center-area">
          {activeTab === 'menu' ? (
            <div className="header-menu-mode-wrapper">
              <button
                type="button"
                className="header-mode-badge"
                onClick={() => {
                  if (orderMode === 'DINE_IN') openTableModal();
                  else setActiveTab('home');
                }}
                title="اضغط لتغيير الطاولة أو نوع الطلب"
              >
                <span className="material-symbols-outlined mode-badge-icon" style={{ fontSize: '15px', color: 'var(--primary)' }}>
                  {orderMode === 'DINE_IN' ? 'table_restaurant' : orderMode === 'PICKUP' ? 'shopping_bag' : 'delivery_dining'}
                </span>
                <span className="mode-badge-text desktop-only">
                  {orderMode === 'DINE_IN'
                    ? `طلب داخل الفرع • طاولة ${tableNumber}`
                    : orderMode === 'PICKUP'
                    ? 'استلام من الفرع (تيك أواي)'
                    : 'توصيل ديليفري للمنزل'}
                </span>
                <span className="mode-badge-text mobile-only">
                  {orderMode === 'DINE_IN'
                    ? `طاولة ${tableNumber}`
                    : orderMode === 'PICKUP'
                    ? 'استلام بالفرع'
                    : 'توصيل منزلي'}
                </span>
                <span className="material-symbols-outlined mode-badge-edit" style={{ fontSize: '13px' }}>
                  {orderMode === 'DINE_IN' ? 'edit' : 'swap_horiz'}
                </span>
              </button>
            </div>
          ) : (
            <div
              className={`header-brand ${isHeroTitleDocked ? 'is-docked' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('home')}
            >
              <div className="brand-row">
                {/* Desktop Side-by-side Docked Title */}
                <span
                  className={`brand-scrolled-title brand-desktop-dock ${isHeroTitleDocked ? 'is-docked' : ''}`}
                  id="brand-scrolled-title"
                >
                  <span className="scrolled-title-text">
                    أين تود الاستمتاع <span className="gold-gradient-text">بقهوتك اليوم؟</span>
                  </span>
                  <span className="brand-separator">•</span>
                </span>
                <span className="brand-name">DIAB CAFE</span>
              </div>
              <div className={`brand-subtitle ${isHeroTitleDocked ? 'is-hidden' : ''}`}>
                <span className="brand-dot"></span>
                <span>Artisanal Roastery</span>
              </div>
            </div>
          )}
        </div>

        {/* Left Side (RTL): Search, User Account & Theme Mode */}
        <div className="header-actions">
          {/* Search Button */}
          <button
            className="theme-toggle-btn header-search-action-btn"
            id="header-search-trigger"
            aria-label="بحث في قائمة المشروبات والبن"
            title="بحث في المنيو"
            onClick={toggleSearch}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>search</span>
          </button>

          {/* User Profile Button */}
          <button
            className="user-login-btn"
            id="login-trigger"
            aria-label="تسجيل الدخول أو حسابي"
            title="حسابي / تسجيل الدخول"
            onClick={openAuthModal}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>account_circle</span>
          </button>

          {/* Theme Mode Toggle Button */}
          <button
            className="theme-toggle-btn"
            id="theme-toggle"
            aria-label="تبديل الوضع الليلي / النهاري"
            title="تبديل المظهر"
            onClick={toggleTheme}
          >
            <span className="material-symbols-outlined icon-sun" style={{ fontSize: '20px' }}>light_mode</span>
            <span className="material-symbols-outlined icon-moon" style={{ fontSize: '20px' }}>dark_mode</span>
          </button>
        </div>
      </div>

      {/* Mobile Dedicated Full-Width Docked Bar Under Entire Header */}
      <div
        className={`brand-mobile-docked-title ${isHeroTitleDocked ? 'is-docked' : ''}`}
        id="brand-mobile-docked-title"
        aria-hidden={!isHeroTitleDocked}
      >
        <span>أين تود الاستمتاع <span className="gold-gradient-text">بقهوتك اليوم؟</span></span>
      </div>
    </header>
  );
};
