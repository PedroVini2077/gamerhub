import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` O CSS NÃO PODE PERDER ASSET — e o Tailwind tem de ser plugin do VITE.
 *
 * ── O bug real, medido ────────────────────────────────────────────────────
 *
 * Com `@tailwindcss/postcss`, o Tailwind achata os `@import` do CSS **antes**
 * de o Vite reescrever os `url()` relativos:
 *
 *     v3   url("/assets/moldura-verde-C42BpkIK.webp")   image/webp
 *     v4   url("/assets/auth/moldura-verde.webp")       text/html   <- sumiu
 *
 * A arte da moldura da tela de entrada deixou de existir.
 *
 * ── Por que nenhum dos ~50 mecanismos pegou ───────────────────────────────
 *
 * | o que | por que passou |
 * | --- | --- |
 * | `npm run build` | CSS com `url()` quebrado compila limpo |
 * | `artes-da-arena.mjs` (6/6 OK) | olha os `<img>` dos lutadores; a moldura é `background-image` |
 * | `smoke.mjs` (18/18 OK) | a rota responde; a imagem é que não |
 * | um `curl` no caminho | devolve **HTTP 200** — o rewrite de SPA entrega o `index.html` |
 *
 * Quem achou foi comparar PRINT da v3 com PRINT da v4, a olho. Isso não roda
 * sozinho, então virou portão.
 *
 * ── As duas metades que esta trava cobre ──────────────────────────────────
 *
 * 1. **O portão existe e o CI o chama.** Script que ninguém chama é cobertura
 *    que não cobre, e o `npm test` não tem como notar.
 * 2. **O Tailwind continua plugin do Vite.** Voltar para o de PostCSS
 *    reintroduz o bug inteiro, e o único sinal seria uma arte sumindo.
 */

const RAIZ = join(import.meta.dirname, '../..');
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');

describe('o CSS não perde asset no caminho para o pacote', () => {
  it('o portão existe e o CI o chama', () => {
    expect(
      existsSync(join(RAIZ, 'scripts/css-nao-perde-asset.mjs')),
      'o portão `css-nao-perde-asset.mjs` sumiu.',
    ).toBe(true);

    expect(
      ler('.github/workflows/ci.yml').includes('node scripts/css-nao-perde-asset.mjs'),
      'o CI deixou de rodar o portão de assets do CSS.\n'
      + 'Ele passa a existir sem nunca rodar: o arquivo fica no repositório, o\n'
      + '`npm test` continua verde, e a única checagem que olha os `url()` do\n'
      + 'pacote deixa de acontecer — em silêncio.',
    ).toBe(true);
  });

  it('zero `url()` numa folha é FALHA, não aprovação', () => {
    // A morte silenciosa do próprio portão: a extração para de casar, ele
    // confere zero url e imprime OK. Este site tem fontes próprias e artes em
    // `background-image` — zero url nunca é a verdade.
    expect(
      /urls\.length === 0[\s\S]{0,400}?falhas\.push/.test(ler('scripts/css-nao-perde-asset.mjs')),
      'o portão deixou de tratar "nenhum url() encontrado" como falha.\n'
      + 'Sem isso, uma mudança no formato do CSS gerado faz ele aprovar sem\n'
      + 'olhar nada — a vacuidade que o `varrerFontes` existe para fechar.',
    ).toBe(true);
  });

  it('o Tailwind é plugin do VITE, não do PostCSS', () => {
    const vite = ler('vite.config.js');

    expect(
      /import tailwindcss from '@tailwindcss\/vite'/.test(vite)
      && /plugins:\s*\[\s*tailwindcss\(\)/.test(vite),
      'o Tailwind deixou de ser plugin do Vite.\n'
      + 'Como plugin de PostCSS ele achata os `@import` ANTES de o Vite\n'
      + 'reescrever os `url()` relativos, e todo asset referenciado pelo CSS\n'
      + 'sai do pacote. Medido: a moldura da tela de entrada virou um caminho\n'
      + 'que devolve `text/html`.',
    ).toBe(true);

    expect(
      existsSync(join(RAIZ, 'postcss.config.js')),
      'o `postcss.config.js` voltou a existir.\n'
      + 'Ele não é necessário — o `@tailwindcss/vite` cuida de tudo, e o\n'
      + '`autoprefixer` virou parte do próprio Tailwind 4. Se ele voltou para\n'
      + 'registrar o Tailwind, é o bug acima de volta.',
    ).toBe(false);
  });
});
