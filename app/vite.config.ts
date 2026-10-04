import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The APIs do not send CORS headers. The browser calls this dev server,
// which forwards to FastAPI (8000) or Express (8001).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/proxy/fastapi': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/fastapi/, ''),
      },
      '/proxy/express': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/express/, ''),
      },
    },
  },
})
