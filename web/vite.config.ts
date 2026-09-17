import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build output lands in ../public, which server.mjs already serves as static
// files. Keeping that contract means the Express side never has to change.
//
// `base` defaults to '/' for a server run standalone at its own domain. Set
// TAPELAY_BASE_PATH when reverse-proxying tapelay under a sub-path (e.g.
// nginx location /tapelay/ -> http://127.0.0.1:3000/), or the built JS/CSS
// will request /assets/... instead of /tapelay/assets/... and 404.
export default defineConfig({
  base: process.env.TAPELAY_BASE_PATH || '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { outDir: '../public', emptyOutDir: true },
  server: {
    port: 5180,
    // `npm run dev` proxies the API to a running `tapelay serve`.
    proxy: {
      '/api': 'http://localhost:3000',
      '/jobs': { target: 'http://localhost:3000', ws: false },
    },
  },
})
