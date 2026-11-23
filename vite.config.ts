/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE wordt in de GitHub Pages workflow gezet op /<repo-naam>/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // De 3D-tafel (three.js) is bewust één losse chunk die pas aan tafel geladen wordt.
  build: { chunkSizeWarningLimit: 1000 },
  test: { include: ['src/**/*.test.ts'] },
});
