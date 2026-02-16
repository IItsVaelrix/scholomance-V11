/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      drafts: {
        customMedia: true,
      },
    },
  },
  // Exclude Node.js-only packages from browser bundle
  optimizeDeps: {
    exclude: ['cmudict', 'better-sqlite3', 'bcrypt'],
  },
  build: {
    cssMinify: 'lightningcss',
    rollupOptions: {
      external: ['cmudict', 'better-sqlite3', 'bcrypt'],
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/collab': 'http://localhost:3000',
      '/audio': 'http://localhost:3000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    include: ['tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['**/tests/visual/**', '**/node_modules/**', 'tests/qa/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**'],
      exclude: ['tests/**'],
    },
  },
})
