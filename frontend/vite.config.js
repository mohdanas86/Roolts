import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  define: {
    global: 'window',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['@monaco-editor/react'],
          'react-vendor': ['react', 'react-dom'],
          'icons': ['react-icons'],
          'utils': ['axios', 'uuid', 'zustand'],
          'ui-components': ['react-markdown', 'react-syntax-highlighter'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [
      '@monaco-editor/react',
      'react-icons',
      'react-markdown',
      'react-syntax-highlighter'
    ]
  }
})
