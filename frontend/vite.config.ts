import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When running inside Docker, the backend is reachable via the service name
// "backend" (Docker internal DNS). Locally it's localhost.
// Set BACKEND_HOST=backend in docker-compose.yml to switch automatically.
const BACKEND_HOST = process.env.BACKEND_HOST ?? 'localhost'
const BACKEND_HTTP = `http://${BACKEND_HOST}:8000`
const BACKEND_WS   = `ws://${BACKEND_HOST}:8000`

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',   // required when running inside Docker
    proxy: {
      // REST API calls: /api → http://<backend>:8000
      '/api': {
        target: BACKEND_HTTP,
        changeOrigin: true,
      },
      // Auth routes: /auth → http://<backend>:8000
      '/auth': {
        target: BACKEND_HTTP,
        changeOrigin: true,
      },
      // WebSocket: /ws → ws://<backend>:8000
      '/ws': {
        target: BACKEND_WS,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
