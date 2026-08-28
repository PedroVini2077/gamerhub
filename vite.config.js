import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        // Os caminhos são casados com `/node_modules/<pacote>/` INTEIRO, e não
        // por pedaço solto. A versão anterior testava `id.includes('/react/')`,
        // que casa com qualquer pacote cujo caminho contenha "react" entre
        // barras — `@sentry/react`, entre outros. O efeito era invisível no
        // build e caro em produção: o Sentry ia parar dentro do `vendor-react`,
        // que é carregado de imediato, e nenhum `import()` dinâmico conseguia
        // separá-lo, porque chunk manual vence divisão automática.
        //
        // Nada de `@sentry` aqui de propósito: é justamente por não ter chunk
        // manual que ele ganha um chunk próprio, sob demanda (`lib/monitoring.js`).
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'vendor-react';
          if (id.includes('/node_modules/react-router-dom/')) return 'vendor-router';
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          if (id.includes('/node_modules/lucide-react/') || id.includes('/node_modules/react-hot-toast/')) return 'vendor-ui';
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
