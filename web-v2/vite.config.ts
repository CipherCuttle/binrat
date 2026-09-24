import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __BINRAT_GITHACK_PREVIEW__: JSON.stringify(process.env.VITE_BINRAT_GITHACK_PREVIEW === '1'),
    __BINRAT_VITE_BASE__: JSON.stringify(process.env.VITE_BINRAT_GITHACK_PREVIEW === '1' ? './' : '/'),
  },
  publicDir: '../web/assets',
  server: {
    port: 4174,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  preview: { port: 4174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
});
