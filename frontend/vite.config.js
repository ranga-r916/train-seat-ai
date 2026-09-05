import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/seats': 'http://127.0.0.1:8000',
      '/bookings': 'http://127.0.0.1:8000',
      '/payments': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
    }
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/seats': 'http://127.0.0.1:8000',
      '/bookings': 'http://127.0.0.1:8000',
      '/payments': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
    }
  }
})
