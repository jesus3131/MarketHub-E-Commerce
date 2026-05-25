import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/products': { target: 'http://localhost:3002', changeOrigin: true },
      '/categories': { target: 'http://localhost:3002', changeOrigin: true },
      '/cart': { target: 'http://localhost:3002', changeOrigin: true },
      '/activities': { target: 'http://localhost:3002', changeOrigin: true },
      '/notifications': { target: 'http://localhost:3002', changeOrigin: true },
      '/inventory': { target: 'http://localhost:3002', changeOrigin: true },
      '/alerts': { target: 'http://localhost:3002', changeOrigin: true },
      '/orders': { target: 'http://localhost:3003', changeOrigin: true },
      '/api': { target: 'http://localhost:3004', changeOrigin: true },
      '/reports': { target: 'http://localhost:3004', changeOrigin: true, ws: true },
      '/promotions': { target: 'http://localhost:3002', changeOrigin: true },
      '/carousel': { target: 'http://localhost:3005', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3005', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist'
  }
});
