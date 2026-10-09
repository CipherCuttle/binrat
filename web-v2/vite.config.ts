import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { ponsPreviewProxy } from './checks/pons-preview-proxy.mjs';

const ponsPreview = process.env.BINRAT_PONS_PREVIEW === '1';
const candidateEntry = process.env.VITE_BINRAT_V3_CANDIDATE === '1';

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
  build: {
    outDir: 'dist', emptyOutDir: true,
    ...(candidateEntry ? { rollupOptions: { input: fileURLToPath(new URL('./frontdoor-candidate.html', import.meta.url)) } } : {}),
  }
});
