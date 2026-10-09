import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // `[09/10]` O Tailwind entra como PLUGIN DO VITE, não como plugin do
  // PostCSS — e isso não é preferência, é correção de um bug medido.
  //
  // Com `@tailwindcss/postcss`, o Tailwind achata os `@import` do CSS ANTES
  // de o Vite reescrever os `url()` relativos. Resultado, provado no build:
  //
  //     v3   url("/assets/moldura-verde-C42BpkIK.webp")   image/webp
  //     v4   url("/assets/auth/moldura-verde.webp")       text/html  <- sumiu
  //
  // A arte da moldura da tela de entrada simplesmente deixava de existir. E o
  // pior: o caminho responde **HTTP 200**, porque o rewrite de SPA devolve o
  // `index.html` para qualquer coisa que não exista — a mesma armadilha que o
  // `portas-da-web.mjs` documenta para o `/.env`.
  //
  // Nenhum teste pegou: o `artes-da-arena.mjs` olha os `<img>` dos lutadores,
  // e a moldura é `background-image`. Quem pegou foi a comparação de PRINT
  // entre as duas versões. Hoje a classe inteira tem trava:
  // `cssNaoPerdeAsset.test.js`.
  plugins: [tailwindcss(), react()],

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
