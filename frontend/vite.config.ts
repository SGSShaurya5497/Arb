import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API calls: /api → http://localhost:8000
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Auth routes: /auth → http://localhost:8000
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // WebSocket: /ws → ws://localhost:8000
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
