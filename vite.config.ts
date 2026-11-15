import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps the build relocatable: it works from a domain root (Cloudflare Pages),
// a sub-path (GitHub Pages project sites) or straight from a zip served by any static server.
export default defineConfig({
  base: './',
  plugins: [react()],
  // two pages: the game (index.html) and the separate Tuning Empire prototype (tuning.html, Phase 6)
  build: { chunkSizeWarningLimit: 1800, target: 'es2022', rollupOptions: { input: { main: 'index.html', tuning: 'tuning.html' } } },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
