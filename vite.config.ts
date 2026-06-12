import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/auth':      'http://localhost:8000',
      '/documents': 'http://localhost:8000',
      '/health':    'http://localhost:8000',
      '/ingest':    'http://localhost:8000',
      '/rag':       'http://localhost:8000',
      '/retrieve':  'http://localhost:8000',
    },
  },
})
