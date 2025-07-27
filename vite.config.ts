import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import prerender from 'vite-plugin-prerender';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-transform-runtime']
      }
    }),
    prerender({
      // Required - The path to the vite-outputted app to prerender.
      staticDir: 'dist',
      // Required - Routes to render for the prerender.
      routes: [ '/' ],
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
