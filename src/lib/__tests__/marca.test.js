import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

  it('toda imagem que o manifesto e o index.html citam EXISTE', () => {
    // `[11/09]` Ícone que some não quebra nada: o navegador mostra o ícone
    // genérico dele, o site continua funcionando, e ninguém percebe até alguém
    // olhar a tela de início. É §1.5 puro — e quase aconteceu hoje, quando os
    // três ícones do manifesto viraram `.webp` e o `manifest.webmanifest`
    // continuava apontando para `.png`.
    const manifesto = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    const html = readFileSync('index.html', 'utf8');

    const citados = [
      ...manifesto.icons.map((i) => i.src),
      ...[...html.matchAll(/<link[^>]+(?:rel="icon"|rel="apple-touch-icon")[^>]+href="([^"]+)"/g)]
        .map((m) => m[1]),
      // O cartão de compartilhamento é citado por URL ABSOLUTA, porque quem o
      // busca é o servidor da rede social. Sem esta linha ele ficaria fora da
      // conferência — e ele é justamente o que ninguém olha no dia a dia.
      ...[...html.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/g)]
        .map((m) => m[1]),
    ].map((caminho) => caminho.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, ''));

    // Sem isto, um `index.html` reescrito sem `<link rel="icon">` deixaria a
    // lista curta e o teste passaria achando que conferiu tudo.
    expect(
      citados.length,
      'Esperava pelo menos 6 imagens citadas (3 do manifesto + favicon + '
      + 'apple-touch + og:image). Achei ' + citados.length + ': '
      + citados.join(', ')
      + '. Se a lista encolheu, alguma <meta> ou <link> sumiu do index.html.',
    ).toBeGreaterThanOrEqual(6);

    for (const caminho of citados) {
      expect(
        existsSync(join('public', caminho)),
        `\`${caminho}\` é citado mas NÃO existe em public/.\n`
        + '  O navegador não reclama disso: ele cai no ícone genérico dele e o\n'
        + '  site segue funcionando, então ninguém percebe até abrir a tela de\n'
        + '  início. Rode `npm run icones` e confira se o manifesto e o\n'
        + '  index.html citam os nomes que o gerador realmente escreve.',
      ).toBe(true);
    }
  });

  it('o tipo declarado no manifesto bate com o arquivo de verdade', () => {
    // Declarar `image/png` num arquivo WebP faz alguns instaladores de PWA
    // recusarem o ícone — e recusar em silêncio, caindo no genérico.
    const manifesto = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    const porExtensao = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };

    for (const icone of manifesto.icons) {
      const ext = icone.src.slice(icone.src.lastIndexOf('.'));
      expect(
        icone.type,
        `${icone.src} está declarado como \`${icone.type}\` no manifesto, mas a `
        + `extensão diz \`${porExtensao[ext]}\`.\n`
        + '  Instalador de PWA que confia no `type` pode recusar o ícone e cair\n'
        + '  no genérico, sem erro nenhum.',
      ).toBe(porExtensao[ext]);
    }
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
