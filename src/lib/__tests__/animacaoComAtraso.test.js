import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A trava do PISCA — animação com atraso que nasce ACESA.
 *
 * ── O bug, relatado por ele e medido antes do conserto ──────────────────────
 *
 * *"Ao recarregar a página ou trocar de abas, as linhas aparecem todas e somem
 * uma por uma, depois a animação acontece."*
 *
 * O mecanismo, e ele é contraintuitivo o bastante para ter passado por três
 * animações diferentes deste projeto: **`animation-delay` não esconde nada**.
 * Durante a espera o navegador desenha o estado NORMAL do elemento. Só quando a
 * animação começa é que o quadro de 0% se aplica.
 *
 * Então um elemento sem `opacity` na regra base (padrão: 1) cujo keyframe
 * começa em `opacity: 0` fica **visível** durante todo o atraso e some de
 * repente. Com atrasos escalonados, eles somem em cascata — que é exatamente o
 * que ele descreveu.
 *
 * Medido em navegador antes do conserto: aos 400 ms, 4 dos 5 traços do ATO 0
 * estavam com opacidade 1 e `dashoffset` 0. Aos 3.200 ms, zero. Os tempos
 * batem com os atrasos (0,7 · 1,4 · 2,1 · 2,8 s).
 *
 * ── Por que a trava é de CLASSE e não do caso ───────────────────────────────
 *
 * Achar o traço do ATO 0 e corrigir só ele deixaria os outros dois que a
 * varredura encontrou — a `.convergencia-ponto` e a `.peca-de-jogo`. É o §1.3:
 * *"onde mais esse mesmo padrão existe?"*.
 *
 * ── O critério, e por que é só OPACIDADE ────────────────────────────────────
 *
 * Comparar TODAS as propriedades daria ruído: quase todo keyframe começa com um
 * `transform` que a regra base não declara, e na maioria isso é invisível
 * porque a opacidade já é 0. **A opacidade é a que decide se aparece** — é ela
 * que transforma o problema em bug visível, e é ela que a trava mede.
 */

const PASTA = 'src/estilos';
const ARQUIVOS = [
  ...readdirSync(PASTA, { recursive: true })
    .filter((f) => String(f).endsWith('.css'))
    .map((f) => join(PASTA, String(f))),
  'src/index.css',
];

/** As declarações do quadro de 0% de cada `@keyframes`, por nome. */
function quadrosIniciais(css) {
  const mapa = {};
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
    // O primeiro seletor do bloco. `0%, 34% {` e `from {` contam os dois.
    const primeiro = m[2].match(/(?:^|\n)\s*(0%|from)[^{]*\{([^}]*)\}/);
    if (primeiro) mapa[m[1]] = primeiro[2];
  }
  return mapa;
}

const opacidadeDe = (bloco) => {
  const m = bloco.match(/(?:^|[;{\s])opacity\s*:\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
};

describe('animação com atraso não pode nascer acesa', () => {
  it('a varredura encontra regras animadas — senão ela não está travando nada', () => {
    // Sem isto, renomear a pasta de estilos deixa o teste verde para sempre
    // sobre zero arquivos. É a lição do `varrerFontes.js`.
    const total = ARQUIVOS.reduce((n, a) => n + [...readFileSync(a, 'utf8')
      .matchAll(/animation(-name)?\s*:/g)].length, 0);
    expect(
      total,
      'A varredura não achou nenhuma regra com `animation`.\n'
      + '  O caminho dos estilos mudou e a trava ficou vazia.',
    ).toBeGreaterThan(8);
  });

  it('quem começa invisível e tem atraso declara `backwards`', () => {
    const faltando = [];

    for (const arquivo of ARQUIVOS) {
      const css = readFileSync(arquivo, 'utf8');
      const quadros = quadrosIniciais(css);

      for (const regra of css.matchAll(/(^|\n)([^\n{}@][^\n{}]*)\{([^}]*)\}/g)) {
        const seletor = regra[2].trim();
        const corpo = regra[3];
        if (/animation[^;]*:\s*none/.test(corpo)) continue;

        const nome = corpo.match(/animation-name\s*:\s*([\w-]+)/)?.[1]
          ?? corpo.match(/animation\s*:\s*([\w-]+)/)?.[1];
        const inicio = nome && quadros[nome];
        if (!inicio) continue;

        // A regra precisa CARREGAR o tempo para ser a dona do problema. Uma que
        // só troca o `animation-name` é VARIANTE de outra — as duas classes vão
        // no mesmo elemento, e o `fill-mode` vem da base.
        //
        // Isto não é conveniência: a primeira versão desta trava acusou
        // `.arena-estilhaco`, que é exatamente esse caso (`arena-particula
        // arena-estilhaco` no mesmo `span`), e "consertar" ali seria repetir uma
        // declaração para calar um alarme falso — o que o §0.2 chama de fadiga.
        //
        // **O que se perde, dito com todas as letras:** uma variante que aponte
        // para um keyframe com 0% diferente, e cuja base NÃO tenha `backwards`,
        // passa batido. O caso é estreito porque a base seria acusada de
        // qualquer forma — só não pelo nome da variante.
        const donaDoTempo = /animation-(delay|duration)\s*:/.test(corpo)
          || /animation\s*:\s*[\w-]+\s+[\d.]/.test(corpo);
        if (!donaDoTempo) continue;

        const noQuadro = opacidadeDe(inicio);
        if (noQuadro === null) continue;
        // Ausente na regra base = 1, que é o padrão do navegador.
        const naBase = opacidadeDe(corpo) ?? 1;
        if (noQuadro === naBase) continue;

        const protegido = /animation-fill-mode\s*:\s*(backwards|both)/.test(corpo)
          || /animation\s*:[^;]*\b(backwards|both)\b/.test(corpo);
        if (!protegido) faltando.push(`${arquivo}  ${seletor}  (@keyframes ${nome})`);
      }
    }

    expect(
      faltando,
      `${faltando.length} regra(s) animam a partir de uma opacidade diferente da\n`
      + '  que o elemento tem parado, e NÃO declaram `backwards`:\n\n'
      + faltando.map((f) => `    ${f}`).join('\n')
      + '\n\n  `animation-delay` NÃO esconde o elemento: durante a espera o\n'
      + '  navegador desenha o estado normal dele, e só ao começar a animação\n'
      + '  aplica o quadro de 0%. Com atraso, isso vira um PISCA — o elemento\n'
      + '  nasce aceso e some de repente; com atrasos escalonados, vários somem\n'
      + '  em cascata. Foi exatamente o que o dono viu no ATO 0 em 12/09.\n\n'
      + '  Conserte de uma das duas formas:\n'
      + '    - `animation-fill-mode: backwards` (aplica o 0% já durante o atraso);\n'
      + '    - ou declare na regra base a MESMA opacidade do quadro de 0%.',
    ).toEqual([]);
  });
});
