import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TenantProvider } from './tenant/TenantContext';
import { UIProvider } from './context/UIContext';
import { CatalogProvider } from './hooks/useCatalog';
import { OrderContextProvider } from './hooks/useOrderContext';
import { CartProvider } from './hooks/useCart';
import './index.css';

// TenantProvider resolves which café this visit is for and loads its
// configuration; everything below it is scoped to that one café.
const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <TenantProvider>
        <UIProvider>
          <CatalogProvider>
            <OrderContextProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </OrderContextProvider>
          </CatalogProvider>
        </UIProvider>
      </TenantProvider>
    </React.StrictMode>
  );
}
