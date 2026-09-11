import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../marca';

/**
 * A marca é UMA só, e ela vem da arte.
 *
 * ── O que estas travas guardam ──────────────────────────────────────────────
 *
 * `[11/09]` A marca nova (o monograma GH) tem uma propriedade que o raio não
 * tinha: ela existe em **cinco lugares** que precisam concordar — o componente
 * React, o `favicon.svg`, e os três PNGs do PWA. Todos são gerados de
 * `lib/marca.js`, e é essa concordância que estas travas defendem.
 *
 * O risco não é teórico. O favicon é um arquivo estático: nada no build o
 * compara com o que o site desenha. Se alguém editar um e não o outro, o ícone
 * da aba passa a ser uma marca **diferente** da do cabeçalho, e nada acusa —
 * §1.5 puro, porque ninguém olha o favicon de propósito.
 */
describe('a marca', () => {
  it('o caminho veio do traçado, e não foi picotado', () => {
    const vertices = (CAMINHO_DA_MARCA.match(/[ML]/g) || []).length;
    expect(
      vertices,
      'O caminho da marca mudou de tamanho. Ele é DERIVADO da arte por '
      + '`scripts/tracar-marca.mjs` — não se edita à mão. Para mudar a marca, '
      + 'troque a arte em docs/identidade/referencias/ e rode o traçador.',
    ).toBeGreaterThanOrEqual(30);
    expect(CAMINHO_DA_MARCA.trim().endsWith('Z')).toBe(true);
  });

  it('o favicon usa EXATAMENTE o mesmo caminho do componente', () => {
    const favicon = readFileSync('public/favicon.svg', 'utf8');
    expect(
      favicon,
      'O `public/favicon.svg` deixou de conter o caminho de `lib/marca.js`.\n'
      + '  O ícone da aba passou a ser uma marca DIFERENTE da que o site desenha,\n'
      + '  e isso não aparece em teste de tela nenhum — ninguém olha o favicon.\n'
      + '  Rode `npm run icones` para regerar tudo da fonte única.',
    ).toContain(CAMINHO_DA_MARCA);
  });

  it('as paradas do gradiente estão em ordem e cobrem as pontas', () => {
    const pos = PARADAS_DO_GRADIENTE.map((p) => p.pos);
    expect(pos[0]).toBe(0);
    expect(pos[pos.length - 1]).toBe(100);
    expect(
      pos,
      'As paradas do gradiente saíram de ordem. Elas foram MEDIDAS na arte '
      + '(ver lib/marca.js) — reordenar troca a leitura do gradiente.',
    ).toEqual([...pos].sort((a, b) => a - b));
    for (const { cor } of PARADAS_DO_GRADIENTE) {
      expect(cor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('o raio NÃO voltou como marca em lugar nenhum', () => {
    // O `Zap` do lucide era a marca antiga. Ele sempre vinha com
    // `text-neon-green` e o brilho verde, colado na palavra GAMER HUB.
    const pastas = ['src/components', 'src/pages'];
    const arquivos = [];
    const varrer = (dir) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          if (nome !== '__tests__') varrer(caminho);
        } else if (/\.jsx$/.test(nome)) arquivos.push(caminho);
      }
    };
    for (const p of pastas) varrer(p);

    // Sem isto, renomear as pastas deixaria a lista vazia e a trava passaria
    // por vacuidade — o mesmo cuidado do `varrerFontes.js`.
    expect(
      arquivos.length,
      'Nenhum .jsx encontrado em src/components ou src/pages. Se as pastas '
      + 'mudaram de lugar, ajuste esta trava — senão ela aprova tudo sem olhar.',
    ).toBeGreaterThan(50);

    const reincidentes = arquivos.filter((a) =>
      /<Zap\s+size=\{\d+\}\s+className="text-neon-green"/.test(readFileSync(a, 'utf8')));

    expect(
      reincidentes,
      `O raio verde voltou como marca em: ${reincidentes.join(', ')}.\n`
      + '  A marca do GamerHub é o monograma GH — use <MarcaGH tamanho={N} />.\n'
      + '  O raio foi aposentado em 11/09, quando o dono trouxe a marca nova.',
    ).toEqual([]);
  });

  it('todo lugar que mostra a marca usa o componente, não um SVG solto', () => {
    const svgSoltos = [];
    const varrer = (dir) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          if (nome !== '__tests__') varrer(caminho);
        } else if (/\.jsx$/.test(nome)) {
          const fonte = readFileSync(caminho, 'utf8');
          // Copiar o `d` para dentro de um componente é como a marca começa a
          // divergir: dois desenhos, um só nome.
          if (fonte.includes(CAMINHO_DA_MARCA.slice(0, 40))
              && !caminho.endsWith('MarcaGH.jsx')) svgSoltos.push(caminho);
        }
      }
    };
    varrer('src');
    expect(
      svgSoltos,
      `O caminho da marca foi copiado para dentro de: ${svgSoltos.join(', ')}.\n`
      + '  Use <MarcaGH /> — duas cópias do mesmo desenho divergem (§4).',
    ).toEqual([]);
  });
});
