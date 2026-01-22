import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Expose Vercel's commit SHA to client-side code for Sentry release tracking
    'import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || ''),
  },
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    react(),
    tailwindcss(),
    // Upload source maps to Sentry (only when SENTRY_AUTH_TOKEN is set)
    process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: 'protein-dojo',
        project: 'javascript-react',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`,
        },
      }),
  ].filter(Boolean),
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
