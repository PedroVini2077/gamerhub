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
          // `[17/09]` O `framer-motion` NÃO ganha chunk próprio, e isto foi
          // MEDIDO, não escolhido por gosto. Ele é o único grande que fica
          // dentro do `index`, e separá-lo parecia ganho de cache óbvio: o
          // `index` muda a cada deploy, a biblioteca não.
          //
          // O resultado foi o contrário:
          //
          //     antes   739,0 kB bruto   224,4 kB gzip
          //     depois  748,5 kB bruto   228,4 kB gzip   <- ESTOUROU o teto
          //
          // Chunk separado comprime PIOR. O gzip trabalha com um dicionário por
          // arquivo, e quebrar um arquivo grande em dois faz cada metade perder
          // o que a outra teria compartilhado. O bruto sobe pelo preâmbulo de
          // módulo; o gzip sobe pela compressão pior.
          //
          // Ou seja: eu trocaria uma economia de cache para quem VOLTA por 4 kB
          // a mais para quem chega pela PRIMEIRA vez — e a primeira visita é
          // exatamente a que o PageSpeed mede em 77. O portão de bytes recusou,
          // e estava certo. Detalhe no `DESEMPENHO.md`.
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
