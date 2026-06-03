import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/react-dom') || (id.includes('/react/') && !id.includes('react-router'))) return 'vendor-react';
          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('lucide-react') || id.includes('react-hot-toast')) return 'vendor-ui';
        },
      },
    },
    chunkSizeWarningLimit: 800,
    sourcemap: false,
  },

  resolve: {
    alias: { '@': '/src' },
  },
});
