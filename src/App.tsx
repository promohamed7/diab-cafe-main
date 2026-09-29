import React, { useEffect } from 'react';
import { useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TableSelectorModal } from './components/TableSelectorModal';
import { AuthModal } from './components/AuthModal';
import { ModifierModal } from './components/ModifierModal';
import { QuickCategoriesModal } from './components/QuickCategoriesModal';
import { Toast } from './components/Toast';

import { HomeModePage } from './pages/HomeModePage';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { HeritagePage } from './pages/HeritagePage';

export const App: React.FC = () => {
  const { activeTab } = useStore();

  // Scroll to top whenever active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  return (
    <>
      <div className="page-wrapper" id="app-wrapper">
        <Header />

        {activeTab === 'home' && <HomeModePage />}
        {activeTab === 'menu' && <MenuPage />}
        {activeTab === 'cart' && <CartPage />}
        {activeTab === 'checkout' && <CheckoutPage />}
        {activeTab === 'order' && <OrderTrackingPage />}
        {activeTab === 'heritage' && <HeritagePage />}
      </div>

      {/* Persistent Bottom Navigation */}
      <BottomNav />

      {/* Interactive Global Modals */}
      <TableSelectorModal />
      <AuthModal />
      <ModifierModal />
      <QuickCategoriesModal />
      <Toast />
    </>
  );
};

export default App;
