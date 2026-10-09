import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` CSS E TAILWIND NÃO PODEM DISPUTAR A MESMA PROPRIEDADE DE TRANSFORM.
 *
 * ── O bug, que foi para produção e ELE viu ────────────────────────────────
 *
 * A marca do hero aparecia deslocada meio tamanho para a direita e para baixo.
 * Print dele: *"o que a logo tá torta na landing?"*.
 *
 * O elemento é ancorado por `left`/`top` no ponto onde o CENTRO da marca deve
 * ficar, e recuava metade de si mesmo com `-translate-x-1/2 -translate-y-1/2`.
 * Ao lado disso, `.marca-flutuante-ponteiro` escreve o desvio do ponteiro na
 * propriedade `translate`. Até o Tailwind 3 eram **propriedades diferentes**:
 *
 *     centragem (Tailwind 3) ...  transform: translate(-50%, -50%)
 *     ponteiro (nosso CSS) .....  translate: <x> <y>
 *
 * **O Tailwind 4 passou a escrever as utilitárias em `translate`.** Medido no
 * CSS gerado:
 *
 *     .-translate-x-1\/2 { translate: var(--tw-translate-x) var(--tw-translate-y) }
 *
 * As duas passaram a disputar a mesma propriedade, a nossa regra ganhou por
 * vir depois no `index.css`, e a centragem deixou de existir.
 *
 * ── Por que nenhum dos ~55 mecanismos pegou ───────────────────────────────
 *
 * | o que | por que passou |
 * | --- | --- |
 * | `npm run build` / lint / 1521 testes | nada quebrou: é geometria, não erro |
 * | `cssNaoPerdeAsset.mjs` | o asset existe; ele só está no lugar errado |
 * | `conteudo-visivel.mjs` | a marca está visível — deslocada, mas visível |
 * | a comparação de PRINT que eu fiz | **foi em 1280 px, e o dano aparece no CELULAR** |
 *
 * O último é o que me ensina mais: eu comparei v3 × v4 lado a lado e dei por
 * bom. Só que a marca tem `min(64vmin, 460px)` — no desktop ela é um detalhe
 * no fundo, e a 390 px ela ocupa 250 px e sai 55 px da tela.
 *
 * ── A trava é por CLASSE, não pelo caso ───────────────────────────────────
 *
 * Ela não pergunta "a marca está centrada?". Pergunta: **existe alguma classe
 * nossa que escreve `translate`/`rotate`/`scale` e é usada junto de uma
 * utilitária do Tailwind que escreve a mesma coisa?** É a pergunta que
 * encontra o PRÓXIMO, não o que já doeu.
 */

const ESTILOS = 'src/estilos';
const PROPRIEDADES = ['translate', 'rotate', 'scale'];

function arquivos(dir, ext, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, achados);
    else if (ext.test(nome)) achados.push(caminho);
  }
  return achados;
}

/** Classes do nosso CSS que escrevem `translate`/`rotate`/`scale` direto. */
function classesComTransformIndividual() {
  const achadas = new Map();
  for (const css of arquivos(ESTILOS, /\.css$/)) {
    const texto = readFileSync(css, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const [, seletor, corpo] of texto.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const prop of PROPRIEDADES) {
        if (!new RegExp(`(^|[;{\\s])${prop}\\s*:`).test(corpo)) continue;
        for (const [, classe] of seletor.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
          if (!achadas.has(classe)) achadas.set(classe, new Set());
          achadas.get(classe).add(prop);
        }
      }
    }
  }
  return achadas;
}

/** Utilitária do Tailwind que escreve a MESMA propriedade individual. */
const UTILITARIA = {
  translate: /(^|\s)-?translate-(x|y|z)?-?\S+/,
  rotate: /(^|\s)-?rotate-\S+/,
  scale: /(^|\s)-?scale-(x|y)?-?\S+/,
};

describe('o CSS não disputa transform com o Tailwind', () => {
  it('a varredura acha as classes — senão ela aprova o vazio', () => {
    // Vacuidade de sempre: se a extração parar de casar, o `for` abaixo não
    // roda nenhuma vez e o teste fica verde para sempre.
    expect(
      classesComTransformIndividual().size,
      'a varredura não achou NENHUMA classe escrevendo translate/rotate/scale.\n'
      + 'O projeto tem pelo menos `.marca-flutuante-ponteiro`. Zero significa\n'
      + 'que a leitura do CSS quebrou, não que o problema acabou.',
    ).toBeGreaterThan(0);
  });

  it('nenhum JSX junta a nossa classe com a utilitária da mesma propriedade', () => {
    const nossas = classesComTransformIndividual();
    const conflitos = [];

    for (const jsx of arquivos('src', /\.jsx$/)) {
      const texto = readFileSync(jsx, 'utf8');
      // só o conteúdo de `className`, para o comentário ao lado não contar
      for (const [, valor] of texto.matchAll(/className=\{?[`"']([\s\S]*?)[`"']\}?/g)) {
        for (const [classe, props] of nossas) {
          if (!new RegExp(`(^|\\s)${classe}(\\s|$)`).test(valor)) continue;
          for (const prop of props) {
            if (UTILITARIA[prop].test(valor)) {
              conflitos.push(`${jsx}: \`.${classe}\` escreve \`${prop}\` e o elemento usa a utilitária do Tailwind`);
            }
          }
        }
      }
    }

    expect(
      conflitos,
      `${conflitos.length} elemento(s) disputando a mesma propriedade:\n`
      + conflitos.map((c) => `  - ${c}`).join('\n')
      + '\n\nNo Tailwind 4 as utilitárias `translate-*`, `rotate-*` e `scale-*`\n'
      + 'escrevem nas PROPRIEDADES INDIVIDUAIS — as mesmas que o nosso CSS usa.\n'
      + 'Uma apaga a outra, e quem ganha é quem vier depois no `index.css`.\n'
      + 'Nada quebra: o elemento continua na tela, só que no lugar errado —\n'
      + 'foi assim que a marca do hero saiu 55 px para fora da tela no celular.\n\n'
      + 'O conserto é juntar as duas no MESMO `calc`, como em\n'
      + '`.marca-flutuante-ponteiro`, e tirar a utilitária do JSX.',
    ).toEqual([]);
  });

  it('a centragem da marca continua DENTRO do `translate` dela', () => {
    const css = readFileSync(join(ESTILOS, 'abertura.css'), 'utf8');

    const regra = css.match(/\.marca-flutuante-ponteiro\s*\{[\s\S]*?\}/);
    expect(regra, 'a regra `.marca-flutuante-ponteiro` sumiu.').not.toBeNull();

    // `[09/10]` DOIS `-50%`, um por eixo. A 1ª versão desta checagem pedia só
    // UM, e eu a provei reinjetando o bug em um eixo só: ela passou. O `-50%`
    // do Y segurava o teste enquanto o X já estava quebrado — metade do bug
    // em produção, com o portão verde.
    expect(
      (regra[0].match(/-50%/g) ?? []).length >= 2,
      'a centragem saiu do `translate` da marca (ou sobrou em um eixo só).\n'
      + 'Ela é ancorada por `left`/`top` no ponto onde o CENTRO deve ficar, e\n'
      + 'sem o recuo de -50% a borda é que fica ali: meio tamanho fora do lugar.\n'
      + 'Medido quando aconteceu: 250 px de marca numa tela de 390, com 55 px\n'
      + 'para fora da direita.',
    ).toBe(true);

    // O bloco de movimento reduzido tem o MESMO buraco, e é o mais fácil de
    // esquecer: `translate: none` apaga o recuo junto com o movimento.
    //
    // `[09/10]` O bloco CERTO, não o primeiro: este arquivo tem DOIS
    // `prefers-reduced-motion`, e o 1º vem ANTES da regra principal. Ancorar
    // nele fazia a checagem ler a regra principal e aprovar — foi assim que
    // ela passou com o bug reinjetado.
    const naReduzida = [...css.matchAll(/@media \(prefers-reduced-motion[^{]*\{([\s\S]*?)\n\}/g)]
      .map((m) => m[1].match(/\.marca-flutuante-ponteiro\s*\{[^}]*\}/))
      .find(Boolean);
    if (naReduzida) {
      expect(
        /-50%/.test(naReduzida[0]),
        'o bloco de movimento reduzido voltou a zerar o `translate` da marca.\n'
        + '`none` tira o movimento E o recuo: a marca sai do lugar justamente\n'
        + 'para quem pediu MENOS movimento — o contrário do que a regra serve.',
      ).toBe(true);
    }
  });
});
