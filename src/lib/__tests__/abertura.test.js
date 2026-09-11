import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DURACAO_TOTAL_MS, FASES, iniciosDaAbertura } from '../tempoDaAbertura';

/**
 * As travas da ABERTURA — três coisas que quebram sem fazer barulho.
 *
 * `[11/09]` A abertura é a primeira coisa que alguém vê no site, e as três
 * falhas abaixo têm a mesma assinatura: **nada estoura, nada vai para log
 * nenhum, e o defeito só aparece para quem está olhando a tela** (§1.5).
 */

const FONTE = (caminho) => readFileSync(caminho, 'utf8');

const ABERTURA = 'src/components/landing/AberturaDaMarca.jsx';
const MARCA_HERO = 'src/components/landing/MarcaFlutuante.jsx';
const CSS = 'src/estilos/abertura.css';

describe('o tempo da abertura', () => {
  it('o total é a soma das fases — sem número solto', () => {
    const soma = Object.values(FASES).reduce((a, b) => a + b, 0);
    expect(DURACAO_TOTAL_MS).toBe(soma);
    // O temporizador do JavaScript usa o total; se ele ficasse menor que a
    // última fase, o véu abriria POR CIMA do brilho ainda correndo.
    const inicios = iniciosDaAbertura();
    expect(inicios.abre + FASES.abre).toBe(DURACAO_TOTAL_MS);
  });

  it('o CSS não tem duração escrita à mão — ele LÊ do módulo', () => {
    const css = FONTE(CSS);
    // Só as regras da abertura. A marca flutuante tem durações próprias (29s,
    // 41s) que não fazem parte do orçamento e são deliberadamente longas.
    const regrasDaAbertura = css
      .split(/\n(?=\.)/)
      .filter((b) => /^\.abertura-/.test(b.trim()));

    expect(
      regrasDaAbertura.length,
      'Nenhuma regra `.abertura-*` encontrada em ' + CSS + '. Se as classes '
      + 'mudaram de nome, ajuste esta trava — senão ela aprova tudo sem olhar.',
    ).toBeGreaterThanOrEqual(3);

    for (const regra of regrasDaAbertura) {
      const duracoesSoltas = regra.match(/animation:[^;]*?\b\d+(\.\d+)?m?s\b/g) || [];
      expect(
        duracoesSoltas,
        `Uma regra de \`.abertura-*\` tem duração escrita à mão:\n`
        + `  ${duracoesSoltas.join(' | ')}\n`
        + '  O orçamento de tempo mora em `src/lib/tempoDaAbertura.js`, e o CSS\n'
        + '  o lê por `var(--dur-*)`/`var(--em-*)`. Com o número nos dois lugares,\n'
        + '  eles divergem na primeira vez que alguém afinar um — e o sintoma é o\n'
        + '  véu abrindo por cima de uma animação pela metade, que não estoura\n'
        + '  erro nenhum.',
      ).toEqual([]);
    }
  });
});

describe('a posição combinada entre a abertura e o hero', () => {
  it('os dois lados leem do MESMO módulo', () => {
    for (const caminho of [ABERTURA, MARCA_HERO]) {
      expect(
        FONTE(caminho),
        `${caminho} deixou de importar de \`lib/marcaNoHero\`.\n`
        + '  A marca da abertura e a do hero precisam estar no MESMO ponto: a\n'
        + '  troca entre elas é um cruzamento, não um voo até uma posição\n'
        + '  medida — medir exige o hero montado, e o hero é `lazy`.\n'
        + '  Se os dois lados discordarem, a marca SALTA no meio da transição.',
      ).toContain('marcaNoHero');
    }
  });

  it('nenhum dos dois crava a posição no próprio arquivo', () => {
    for (const caminho of [ABERTURA, MARCA_HERO]) {
      const fonte = FONTE(caminho)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      // `left: '50%'` ou `top: '49%'` escrito na mão é a divergência nascendo.
      const cravados = fonte.match(/(left|top):\s*['"]\d+%['"]/g) || [];
      expect(
        cravados,
        `${caminho} crava a posição: ${cravados.join(', ')}.\n`
        + '  Ela tem que vir de `CENTRO_DA_MARCA`, senão os dois lados divergem\n'
        + '  silenciosamente e a marca salta na troca.',
      ).toEqual([]);
    }
  });
});

describe('o ponteiro tem UM ouvinte só', () => {
  it('nenhum outro arquivo escuta `pointermove`', () => {
    const encontrados = [];
    const varrer = (dir) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          if (nome !== '__tests__') varrer(caminho);
        } else if (/\.jsx?$/.test(nome) && FONTE(caminho).includes("'pointermove'")) {
          encontrados.push(caminho);
        }
      }
    };
    varrer('src');

    // Sem isto, mover o hook de lugar deixaria a lista vazia e a trava passaria
    // por vacuidade — o mesmo cuidado do `varrerFontes.js`.
    expect(
      encontrados.length,
      'Nenhum ouvinte de `pointermove` encontrado em src/. O hook sumiu ou '
      + 'mudou de nome, e esta trava deixou de vigiar qualquer coisa.',
    ).toBeGreaterThan(0);

    expect(
      encontrados,
      `Mais de um lugar escuta \`pointermove\`: ${encontrados.join(', ')}.\n`
      + '  Dois ouvintes são duas verdades sobre onde o ponteiro está, e elas\n'
      + '  divergem sem erro nenhum — um elemento acompanha o mouse e o vizinho\n'
      + '  fica para trás. O ouvinte único é `hooks/usePonteiroDaPagina.js`;\n'
      + '  quem precisa da posição lê `var(--ponteiro-x, 0)`.',
    ).toEqual(['src/hooks/usePonteiroDaPagina.js']);
  });

  it('quem lê a variável do ponteiro tem valor PADRÃO', () => {
    // No celular ninguém escreve a variável. Sem o padrão, o `calc` inteiro
    // morre e o elemento some da tela — sem erro, sem log, sem teste quebrando.
    const lugares = [CSS, 'src/components/landing/FluxoDeDados.jsx'];
    for (const caminho of lugares) {
      const usos = FONTE(caminho).match(/var\(--ponteiro-[xy][^)]*\)/g) || [];
      expect(
        usos.length,
        `${caminho} não usa \`--ponteiro-*\`. Se o nome da variável mudou, `
        + 'ajuste esta trava — senão ela aprova sem olhar.',
      ).toBeGreaterThan(0);

      for (const uso of usos) {
        expect(
          uso,
          `${caminho} lê \`${uso}\` sem valor padrão.\n`
          + '  No celular a variável não existe (não há ponteiro), o `calc`\n'
          + '  inteiro vira inválido e o elemento SOME da tela — em silêncio.\n'
          + '  Escreva `var(--ponteiro-x, 0)`.',
        ).toMatch(/,\s*0\s*\)/);
      }
    }
  });
});
