import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Landing page at root
        main: resolve(__dirname, 'index.html'),
        // React app at /app
        app: resolve(__dirname, 'app/index.html'),
      },
      output: {
        // Split stable vendor code from app code so returning visitors
        // keep cached vendor chunks across app deploys.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    }
  }
})
