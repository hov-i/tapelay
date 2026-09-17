import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build output lands in ../public, which server.mjs already serves as static
// files. Keeping that contract means the Express side never has to change.
//
// Always builds with base '/'. A sub-path deploy (e.g. nginx location
// /tapelay/ -> http://127.0.0.1:3000/) does not need a different build —
// server.mjs rewrites index.html's asset paths at request time based on
// TAPELAY_BASE_PATH, since the hashed filenames themselves never change.
export default defineConfig({
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
