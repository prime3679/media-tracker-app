import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      includeAssets: ['favicon.ico'],
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Media Tracker',
        short_name: 'MediaTracker',
        description: 'Track your movies, TV shows, and books',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512', 
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['entertainment', 'productivity']
      }
    })
  ],
  resolve: {
    alias: {
      '@tanstack/react-query': '/src/lib/tanstack-react-query.tsx',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  define: {
    global: 'globalThis',
  }
})
