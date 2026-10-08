import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ponsPreviewProxy } from './checks/pons-preview-proxy.mjs';

const ponsPreview = process.env.BINRAT_PONS_PREVIEW === '1';

export default defineConfig({
  plugins: [react(), ...(ponsPreview ? [ponsPreviewProxy()] : [])],
  publicDir: '../web/assets',
  server: {
    port: 4174,
    strictPort: true,
    proxy: ponsPreview ? {} : {
      '/api': 'http://localhost:3000'
    }
  },
  preview: { port: 4174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
});
