import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two single-page apps built from one codebase:
//   index.html        — the customer digital menu (every café, branded at runtime)
//   admin/index.html  — the INBYTE Admin
// In production both are served by the INBYTE backend (server/), which also
// serves /api/*. In development `npm run dev` uses the in-browser mock for the
// customer site; /api is proxied to a locally running backend (npm run server:dev).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Lets phones on the local network open the dev server (e.g. to test QR links).
    allowedHosts: true,
    proxy: {
      '/api': { target: process.env.PLATFORM_DEV_API ?? 'http://localhost:8080', changeOrigin: false }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  }
});
