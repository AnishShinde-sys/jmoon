import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Removed COOP header to allow external resources (Mapbox CSS) and window.closed calls
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    // },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
