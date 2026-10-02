import React, { useEffect } from 'react';
import { useUI } from './context/UIContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ModifierModal } from './components/ModifierModal';
import { QuickCategoriesModal } from './components/QuickCategoriesModal';
import { Toast } from './components/Toast';
import { DevMockBanner } from './components/DevMockBanner';
import { TableSessionBanner } from './components/TableSessionBanner';
import { AnnouncementBanner } from './components/AnnouncementBanner';

import { HomeModePage } from './pages/HomeModePage';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { AboutPage } from './pages/AboutPage';

export const App: React.FC = () => {
  const { activeTab } = useUI();

  // Scroll to top whenever active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  return (
    <>
      <div className="page-wrapper" id="app-wrapper">
        <Header />
        {/* Clears the fixed header itself when it has content (see ordering.css). */}
        <div className="ordering-banners">
          <DevMockBanner />
          <AnnouncementBanner />
          <TableSessionBanner />
        </div>

        {activeTab === 'home' && <HomeModePage />}
        {activeTab === 'menu' && <MenuPage />}
        {activeTab === 'cart' && <CartPage />}
        {activeTab === 'checkout' && <CheckoutPage />}
        {activeTab === 'order' && <OrderTrackingPage />}
        {activeTab === 'about' && <AboutPage />}
      </div>

      {/* Persistent Bottom Navigation */}
      <BottomNav />

      {/* Interactive Global Modals */}
      <ModifierModal />
      <QuickCategoriesModal />
      <Toast />
    </>
  );
};

export default App;
