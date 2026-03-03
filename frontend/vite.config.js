import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'events': path.resolve(__dirname, 'src/utils/events-polyfill.js'),
      'util': path.resolve(__dirname, 'src/utils/util-polyfill.js'),
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true
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
      'react-icons/fi',
      'react-icons/si',
      'react-icons/vsc',
      'react-icons/lu',
      'react-markdown',
      'react-syntax-highlighter'
    ]
  }
})
