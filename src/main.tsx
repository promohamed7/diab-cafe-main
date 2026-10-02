import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UIProvider } from './context/UIContext';
import { CatalogProvider } from './hooks/useCatalog';
import { OrderContextProvider } from './hooks/useOrderContext';
import { CartProvider } from './hooks/useCart';
import { purgeLegacyPrototypeData } from './services/storage';
import './index.css';

// Remove the old prototype's demo data (fake user, simulated orders, default table).
purgeLegacyPrototypeData();

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <UIProvider>
        <CatalogProvider>
          <OrderContextProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </OrderContextProvider>
        </CatalogProvider>
      </UIProvider>
    </React.StrictMode>
  );
}
