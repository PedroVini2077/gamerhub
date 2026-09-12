import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from './varrerFontes.js';

/**
 * As travas dos SINAIS DE VIDA — a camada de produto animada do ATO 0.
 *
 * `[12/09]` Elas nasceram dentro de `prologo.test.js` e saíram de lá quando o
 * arquivo passou de 300 linhas (§4). O corte não é por tamanho: o `prologo`
 * trava a **narrativa por rolagem** (as janelas, o `sticky`, os cinco atos), e
 * estas travam uma **camada** que mora dentro de um ato só. São dois assuntos
 * que mudam por motivos diferentes.
 *
 * O que todas têm em comum é a assinatura da falha: **o chip existe no DOM, o
 * navegador desenha, e ninguém vê** — traço fino demais, texto cortado pela
 * borda, fundo translúcido sobre a parte clara da arte. Nada estoura, nada vai
 * para log nenhum, e a primeira tela volta a ser arte + frase (§1.5).
 */

const FONTE = (c) => readFileSync(c, 'utf8');
const PROLOGO = 'src/components/landing/PrologoDaLanding.jsx';

describe('os sinais de vida do ATO 0', () => {
  const SINAIS = 'src/components/landing/prologo/SinaisDeVida.jsx';
  const CSS = 'src/estilos/sinaisDeVida.css';

  it('o ATO 0 monta os sinais', () => {
    // Sem isto o componente existe, é testado, e a primeira tela volta a ser
    // arte + frase — o "um pouco vazia" que o dono descreveu.
    expect(
      FONTE(PROLOGO),
      'O prólogo deixou de montar os `SinaisDeVida`.',
    ).toContain('<SinaisDeVida');
  });

  it('eles são FRAGMENTOS DO PRODUTO, não efeitos genéricos', () => {
    // A regra que ele escreveu, palavra por palavra: **ARTE + CAMADA DE PRODUTO
    // ANIMADA**, e não **ARTE + EFEITOS VISUAIS GENÉRICOS**.
    //
    // A deriva aqui é fácil e silenciosa: alguém acha o chip discreto demais,
    // troca por um brilho ou uma partícula, e a cena continua "viva" — só que
    // dizendo nada sobre o GamerHub.
    const fonte = FONTE(SINAIS);
    for (const fragmento of ['curtida', 'digitando', 'online', 'key', 'xp', 'live']) {
      expect(
        fonte.includes(`id: '${fragmento}'`),
        `O sinal "${fragmento}" sumiu do ATO 0.\n`
        + '  Cada um é um fragmento de uma cena de baixo aparecendo de relance.\n'
        + '  Trocar um por um efeito abstrato quebra a regra que o dono escreveu:\n'
        + '  arte + camada de PRODUTO, nunca arte + efeito genérico.',
      ).toBe(true);
    }
  });

  it('eles SAEM antes de a transformação começar', () => {
    // Se ficassem, um chip piscaria enquanto a arte se desfaz e a frase sai —
    // dois assuntos na tela, e o ato da transformação perde o foco.
    expect(
      /JANELAS\.fraseSai\[0\]/.test(FONTE(SINAIS)),
      'Os sinais deixaram de sair junto com a frase.\n'
      + '  A janela deles precisa terminar onde a da frase começa, senão eles\n'
      + '  atravessam a TRANSFORMAÇÃO disputando atenção com ela.',
    ).toBe(true);
  });

  it('o ciclo é CSS e PARA quando a cena sai da tela', () => {
    const css = FONTE(CSS);
    const fonte = FONTE(SINAIS);
    // Seis elementos em laço infinito no `requestAnimationFrame` seria trabalho
    // de thread principal para sempre. Em `@keyframes` é compositor.
    expect(
      /@keyframes sinalDeVida/.test(css),
      'O ciclo dos sinais saiu do CSS.\n'
      + '  Seis laços infinitos numa biblioteca de animação rodam na thread\n'
      + '  principal, numa página que já paga uma arte de tela cheia.',
    ).toBe(true);
    expect(
      /animation-play-state: paused/.test(css) && /sinais-parados/.test(fonte),
      'Os sinais deixaram de pausar fora da tela.\n'
      + '  Eles continuariam animando para quem já rolou até o rodapé — a versão\n'
      + '  barata dos 29.441 ms que a cena 3D custou.',
    ).toBe(true);
  });

  it('quem pediu menos movimento continua vendo os sinais', () => {
    // Eles não são enfeite: são a única coisa que diz que aquele mundo tem
    // gente dentro. O ciclo some; o conteúdo fica.
    const css = FONTE(CSS);
    const reduzido = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(
      /animation: none/.test(reduzido) && /opacity: 1/.test(reduzido),
      'No modo sem movimento os sinais somem em vez de ficarem parados.\n'
      + '  Com `animation: none` e sem `opacity: 1` eles herdam o estado\n'
      + '  inicial do keyframe, que é INVISÍVEL: a primeira tela volta a ser\n'
      + '  arte + frase para quem desligou animação.',
    ).toBe(true);
  });
});

describe('os sinais do ATO 0 são VISÍVEIS', () => {
  const SINAIS = 'src/components/landing/prologo/SinaisDeVida.jsx';
  const CSS = 'src/estilos/sinaisDeVida.css';

  it('nenhum sinal transborda a tela do celular', () => {
    // `[12/09]` O bug que o dono viu no telefone: *"alguns dos css estão
    // cortadas no celular, não estão dentro da cena"*.
    //
    // O mecanismo: chip com `whitespace-nowrap` ancorado por `left-[74%]`
    // **cresce para a direita** a partir dali, e a largura dele vem do TEXTO,
    // não do espaço que sobra. Num monitor de 1440 px sobram 374 px depois de
    // 74%; num telefone de 360 sobram 94, e "key liberada" precisa de ~125.
    //
    // Por isso a trava mede a CONTA, e não a existência de um `right`: trocar a
    // âncora resolveu este caso, mas o que precisa continuar verdade é que o
    // chip caiba. Um texto mais longo amanhã reabre o buraco sem tocar na
    // âncora — e não existe erro nenhum quando ele reabre: o chip fica cortado
    // pelo `overflow-x-clip` do palco, calado.
    //
    // Os números do estimador são medidos, não chutados: `font-mono` a
    // `text-[0.7rem]` (11,2 px) dá ~0,6em por caractere; `px-3` são 24 px de
    // recheio; ícone 13 px + `gap-2` 8 px; os três pontos do "digitando" somam
    // ~22 px + o mesmo gap.
    const LARGURA_DO_CELULAR = 360;
    const POR_CARACTERE = 11.2 * 0.6;
    const RECHEIO = 24;

    const fonte = FONTE(SINAIS);
    const declarados = [...fonte.matchAll(/id: '[a-z]+'/g)].length;
    const sinais = [...fonte.matchAll(
      /id: '([a-z]+)', lado: '(esq|dir)', x: '(\d+)%'[\s\S]{0,220}?\n\s{2}\},/g,
    )];

    // Sem isto a trava vira decoração no dia em que alguém mudar a FORMA da
    // lista: zero casamentos passam por zero violações, e o teste fica verde
    // para sempre sem ter lido nada (a lição do `varrerFontes.js`).
    expect(
      sinais.length,
      `Li ${sinais.length} sinais de ${declarados} declarados em SinaisDeVida.jsx.\n`
      + '  A trava não conseguiu ler a lista, então ela não está travando nada.\n'
      + '  Se a forma de `SINAIS` mudou, o casamento aqui precisa mudar junto.',
    ).toBe(declarados);

    for (const [bloco, id, , distancia] of sinais) {
      const texto = bloco.match(/texto: '([^']+)'/)[1];
      const largura = texto.length * POR_CARACTERE + RECHEIO
        + (/icone:/.test(bloco) || /pulso: true/.test(bloco) ? 21 : 0)
        + (/pontos: true/.test(bloco) ? 30 : 0);
      const ocupado = (Number(distancia) / 100) * LARGURA_DO_CELULAR + largura;

      expect(
        ocupado,
        `O sinal "${id}" ocupa ~${Math.round(ocupado)} px numa tela de `
        + `${LARGURA_DO_CELULAR} px.\n`
        + `  Ele se ancora a ${distancia}% de uma borda e o texto "${texto}" pede\n`
        + `  ~${Math.round(largura)} px, que crescem PARA DENTRO da tela a partir dali.\n`
        + '  Passando da largura, o chip é cortado pelo `overflow-x-clip` do\n'
        + '  palco — sem erro, sem log, sem teste: só um pedaço de texto que\n'
        + '  some na borda, que foi o que o dono viu no telefone.\n'
        + '  Encurte o texto, ou aproxime o sinal da borda que o ancora.',
      ).toBeLessThanOrEqual(LARGURA_DO_CELULAR);
    }
  });

  it('o chip tem fundo OPACO — a arte é colorida por baixo dele', () => {
    // `[12/09]` Ele viu no telefone: *"o fundo é colorido, e o texto com esse
    // balão vazado não dá pra enxergar muito"*.
    //
    // Fundo translúcido sobre a arte é legível na parte escura dela e ilegível
    // na parte clara — o MESMO chip, dependendo de onde pousou. É pior do que
    // ilegível sempre: não parece defeito, parece a arte.
    //
    // A trava lê a classe aplicada, e não o comentário: `bg-dark-900/78` e
    // `bg-dark-900` só diferem por dois caracteres, e a diferença some numa
    // revisão.
    const chip = FONTE(SINAIS).match(/className="flex items-center gap-2[\s\S]*?"/)[0];
    const fundo = chip.match(/\bbg-[\w-]+(\/\d+)?/)?.[0];

    expect(fundo, 'Não achei a classe de fundo do chip — a trava ficaria vazia.').toBeTruthy();
    expect(
      /\/\d+$/.test(fundo),
      `O fundo do chip voltou a ser translúcido (\`${fundo}\`).\n`
      + '  Sobre a arte do ATO 0 isso deixa o texto legível num canto da tela e\n'
      + '  ilegível no outro, sem nada acusar.',
    ).toBe(false);
  });

  it('mais de um sinal convive na tela', () => {
    // A conta que o dono percebeu como "muito sutil": 9 sinais a 1,4 s de
    // distância, cada um visível 17% de 13 s (~2,2 s), dá UM por vez. Com 30%
    // (~3,9 s) passam a conviver ~3.
    //
    // A trava confere a conta, e não a aparência: `visivel * ciclo >= 2 x
    // espaçamento` é o mínimo para dois se sobreporem.
    const css = FONTE(CSS);
    const ciclo = Number(css.match(/animation: sinalDeVida ([\d.]+)s/)[1]);
    const visivel = Number(css.match(/\n\s*(\d+)%\s*\{ opacity: 1; transform: translateY\(0\)[^}]*\}\n\s*36%/)?.[1]
      ?? css.match(/(\d+)%\s*\{ opacity: 1; transform: translateY\(0\) scale\(1\); \}\s*\n\s*36%/)?.[1]);
    const sinais = [...FONTE(SINAIS).matchAll(/atraso: '([\d.]+)s'/g)].map((m) => Number(m[1]));
    const espacamento = sinais[1] - sinais[0];

    expect(visivel, 'Não achei a janela visível no keyframe — a trava ficaria vazia.').toBeGreaterThan(0);
    expect(
      (visivel / 100) * ciclo,
      `Cada sinal fica visível ${((visivel / 100) * ciclo).toFixed(1)} s, com `
      + `${espacamento} s entre eles.\n`
      + '  Com essa conta aparece UM de cada vez, e o ATO 0 volta a parecer\n'
      + '  parado — que foi exatamente o que o dono relatou. É a única tela da\n'
      + '  landing onde nada mais se move: ali, sutil vira nada.',
    ).toBeGreaterThanOrEqual(espacamento * 2);
  });
});

/**
 * `[12/09]` Esta varredura era um teste de UM arquivo, e virou de CLASSE.
 *
 * Ela nasceu medindo o `strokeWidth` dos traços do ATO 0. Esses traços foram
 * REMOVIDOS a pedido do dono — e uma trava que varre um arquivo que perdeu o
 * alvo não falha: ela itera zero vezes e fica **verde para sempre**, que é a
 * lição inteira do `varrerFontes.js`.
 *
 * A escolha então foi entre apagá-la e generalizá-la. Generalizar, porque o bug
 * que ela pega **não era dos traços**: é da UNIDADE. `vector-effect:
 * non-scaling-stroke` fixa a espessura em PIXEL DE TELA, e não em unidade do
 * `viewBox` — então um número que parece razoável ali dentro (`0.18` num
 * `viewBox` de 100) é literalmente invisível. O elemento existe no DOM, o
 * navegador desenha, e ninguém vê (§1.5).
 *
 * Hoje há três outros lugares com o mesmo efeito (`ConvergenciaDoHub`,
 * `AssinaturaDoRodape`), e a próxima decoração da landing será a quarta.
 */
describe('traço com `non-scaling-stroke` é grosso o bastante para existir', () => {
  it('nenhum arquivo da landing desenha um traço abaixo de 0,5 px de tela', () => {
    const arquivos = varrerFontes('src/components/landing');
    const comEfeito = arquivos.filter((c) => /non-scaling-stroke/.test(FONTE(c)));

    // A guarda do `varrerFontes` cobre a pasta sumir; esta cobre o EFEITO
    // sumir da pasta. Sem ela, o dia em que ninguém mais usar
    // `non-scaling-stroke` deixa a trava verde sem ter medido nada — e ela
    // continuaria parecendo vigiar a próxima vez que alguém usar.
    expect(
      comEfeito.length,
      `Nenhum arquivo de ${arquivos.length} em src/components/landing usa\n`
      + '  `non-scaling-stroke`. Ou o efeito deixou de ser usado (e esta trava\n'
      + '  não protege mais nada), ou o nome dele mudou. Confira antes de\n'
      + '  aceitar o verde.',
    ).toBeGreaterThan(0);

    for (const caminho of comEfeito) {
      const fonte = FONTE(caminho);
      for (const [, largura] of fonte.matchAll(/strokeWidth="([\d.]+)"/g)) {
        expect(
          Number(largura),
          `${caminho} desenha um traço de ${largura} px de espessura.\n`
          + '  Com `non-scaling-stroke` a espessura é em PIXEL DE TELA, não em\n'
          + '  unidade do `viewBox` — um valor que parece proporcional ali\n'
          + '  dentro pode ser invisível na tela. Abaixo de ~0,5 px o traço\n'
          + '  some, e nada acusa: o elemento existe no DOM e o navegador\n'
          + '  desenha nada.',
        ).toBeGreaterThanOrEqual(0.5);
      }
    }
  });
});
