import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { serviceWorker } from './vite-plugins/service-worker.ts';
import { syncApi } from './vite-plugins/sync-api.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), syncApi(), serviceWorker()],
  build: {
    // Le dictionnaire allemand (~5 Mo) reste un fichier séparé, jamais inliné.
    assetsInlineLimit: 0,
  },
});
