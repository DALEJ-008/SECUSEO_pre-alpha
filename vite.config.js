import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api, /admin, POST /login, /logout, /verify-phone and /media to Django
// backend during development so the React app can be served from a different
// port/host (e.g. StackBlitz) without hitting CORS/cookie issues, as long as
// the Django server is reachable from wherever `npm run dev` runs.
// Set VITE_BACKEND_URL to point at your Django server (default: localhost:8000).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
        '/admin': { target, changeOrigin: true },
        '/login': {
          target,
          changeOrigin: true,
          bypass: (req) => (req.method === 'GET' ? '/index.html' : undefined),
        },
        '/logout': { target, changeOrigin: true },
        '/verify-phone': { target, changeOrigin: true },
        '/media': { target, changeOrigin: true },
      },
    },
  }
})
