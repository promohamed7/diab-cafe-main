import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './AdminApp';
import './admin.css';

const root = document.getElementById('admin-root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AdminApp />
    </React.StrictMode>
  );
}
