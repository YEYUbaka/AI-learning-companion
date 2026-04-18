import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/knowledge_base': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/docs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/openapi.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    },
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(',').map(h => h.trim())
      : ['yeyubaka.f1.luyouxia.net', '37yy041dv797.vicp.fun']
  }
})
