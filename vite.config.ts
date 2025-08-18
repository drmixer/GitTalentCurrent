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
        // Stable filenames to avoid 404 after deploys
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: (assetInfo) => {
          // Give the main CSS a stable name
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/app.css';
          }
          // Keep other assets using their source names
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
