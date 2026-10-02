import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is a static SPA. There is no server-side API in this repository:
// the Café integration is reached through the transport configured with
// VITE_CAFE_TRANSPORT / VITE_CAFE_API_BASE_URL (see docs/WEBSITE_INTEGRATION.md).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Lets phones on the local network open the dev server (e.g. to test QR links).
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  }
});
