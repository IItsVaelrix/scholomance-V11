/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Exclude Node.js-only packages from browser bundle
  optimizeDeps: {
    exclude: ['cmudict', 'better-sqlite3', 'bcrypt'],
  },
  build: {
    rollupOptions: {
      external: ['cmudict', 'better-sqlite3', 'bcrypt'],
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    include: ['tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['**/tests/visual/**'],
  },
})
