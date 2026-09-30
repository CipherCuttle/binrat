import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
