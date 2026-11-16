import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development every /api/* request is proxied to the FastAPI server,
// so the browser never needs CORS and the API URL lives in one place.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
