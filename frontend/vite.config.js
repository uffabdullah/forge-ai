import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind 4 is configured entirely in CSS (see src/styles/index.css) — there is
// no tailwind.config.js and no PostCSS config to maintain.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./components', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
