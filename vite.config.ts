import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // absolute-from-root URLs
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-transform-runtime'],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    assetsDir: 'assets',
    sourcemap: false,
    // Keep a single CSS file so we can give it a stable name
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Use content-based hashes for cache busting, but ensure proper asset handling
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
