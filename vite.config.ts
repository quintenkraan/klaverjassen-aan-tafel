/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE wordt in de GitHub Pages workflow gezet op /<repo-naam>/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
});
