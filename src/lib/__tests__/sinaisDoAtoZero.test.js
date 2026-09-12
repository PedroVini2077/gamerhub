import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

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

  it('nenhum traço é fino demais para existir na tela', () => {
    // `[12/09]` O bug: `strokeWidth="0.18"` JUNTO com
    // `vector-effect="non-scaling-stroke"`. O efeito fixa a espessura em PIXEL
    // DE TELA, então 0,18 é literalmente invisível — o desenho estava certo, o
    // navegador desenhava, e ninguém via.
    //
    // Não é hipótese: a convergência do hero usa 1,4 com o mesmo efeito, e ela
    // aparece. A diferença entre as duas era só este número.
    const fonte = FONTE(SINAIS);
    for (const [, largura] of fonte.matchAll(/strokeWidth="([\d.]+)"/g)) {
      expect(
        Number(largura),
        `Um traço dos sinais está com ${largura} px de espessura.\n`
        + '  Com `non-scaling-stroke` a espessura é em pixel de tela, não em\n'
        + '  unidade do `viewBox`. Abaixo de ~0,5 px o traço some, e nada acusa:\n'
        + '  o elemento existe no DOM e o navegador desenha nada.',
      ).toBeGreaterThanOrEqual(0.5);
    }
  });

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

describe('as ligações do ATO 0 são ENERGIA, e existem no celular', () => {
  const SINAIS = 'src/components/landing/prologo/SinaisDeVida.jsx';
  const ICONES = 'scripts/gerar-icones.mjs';

  it('as linhas NÃO são escondidas no celular', () => {
    // `[12/09]` Ele perguntou por que as linhas do começo não apareciam no
    // telefone. A resposta era um `hidden md:block` no SVG — cautela minha de
    // quando os chips ainda transbordavam, que virou defeito quando eles
    // pararam de transbordar e ninguém revisitou a classe.
    const svg = FONTE(SINAIS).match(/<svg[\s\S]*?viewBox="0 0 100 100"[\s\S]*?>/)[0];
    expect(
      /\bhidden\b/.test(svg),
      'O SVG das ligações voltou a ser escondido no celular.\n'
      + '  Elas são metade do que faz o ATO 0 parecer vivo, e o celular é onde\n'
      + '  ele passa mais tempo na tela — a arte em pé demora mais para rolar.',
    ).toBe(false);
  });

  it('o traço acende NA DIREÇÃO do centro, e não por igual', () => {
    // Pedido: *"queria que essas linhas fossem tipo energia se concentrando ali
    // no meio, senti elas bem apagadinhas"*.
    //
    // A trava mede a FORMA do gradiente, não o brilho: um traço de opacidade
    // uniforme lê como risco na tela, e é o que ele descreveu. O que lê como
    // energia indo para algum lugar é a ponta de chegada ser a mais forte.
    const fonte = FONTE(SINAIS);
    const grad = fonte.match(/id=\{`ligacao-\$\{i\}`\}[\s\S]*?<\/linearGradient>/)?.[0];
    expect(grad, 'Sumiu o gradiente das ligações — elas voltaram a ser cor chapada.').toBeTruthy();

    const paradas = [...grad.matchAll(/offset="(\d+)%"[^/]*stopOpacity="([\d.]+)"/g)]
      .map(([, o, a]) => ({ onde: Number(o), opacidade: Number(a) }));
    const borda = paradas.find((p) => p.onde === 0);
    const centro = paradas.find((p) => p.onde === 100);

    expect(
      centro.opacidade,
      `A ponta do traço no CENTRO está em ${centro.opacidade} e a da borda em `
      + `${borda.opacidade}.\n`
      + '  O gradiente precisa ACENDER na direção do centro — é o que separa\n'
      + '  "energia se concentrando" de "risco na tela", que foi a diferença que\n'
      + '  o dono apontou. Pelo menos 3x a opacidade da borda.',
    ).toBeGreaterThan(Math.max(borda.opacidade * 3, 0.6));
  });

  it('a borda do ícone do app é fração do lado, não pixel fixo', () => {
    // `[12/09]` *"O app tá com a logo e o fundo preto, faltou uma borda"*. Ela
    // EXISTIA: `stroke-width="1.2"` num `viewBox` de 512 — 0,23% do lado, que na
    // tela de início vira 0,3 pixel. Mesmo defeito de unidade dos traços de
    // 0,18 px: o número parece razoável e não é, porque a unidade não é pixel.
    const linha = FONTE(ICONES).match(/stroke-width="\$\{([^}]+)\}"/)?.[1]
      ?? FONTE(ICONES).match(/stroke-width="([\d.]+)"/)?.[1];
    expect(linha, 'Não achei a espessura da borda do ícone — a trava ficou vazia.').toBeTruthy();
    expect(
      /cx|cy|lado|largura/.test(String(linha)),
      `A borda do ícone voltou a ter espessura fixa (\`${linha}\`).\n`
      + '  O `viewBox` do ícone é do TAMANHO dele (192, 512...), então número\n'
      + '  constante vale proporções diferentes em cada arquivo gerado — e no\n'
      + '  maior ele some. A espessura precisa ser fração do lado.',
    ).toBe(true);
  });
});

describe('as ligações do ATO 0 são ABSORVIDAS, não desbotam', () => {
  const SINAIS = 'src/components/landing/prologo/SinaisDeVida.jsx';
  const CSS = 'src/estilos/sinaisDeVida.css';

  it('o traço DRENA para o centro — `dashoffset` chega a negativo', () => {
    // `[12/09]` *"Ao fim das animações as linhas somem aos poucos, mas fica uns
    // pontos estranhos ali no meio."*
    //
    // A causa: o traço chegava ao centro e ficava 2,3 s desbotando INTEIRO e
    // imóvel. Com cinco atrasos diferentes, sempre havia pedaços fracos de
    // várias linhas ao mesmo tempo perto do centro.
    //
    // Levar o `dashoffset` a negativo faz a cauda entrar atrás da cabeça: a
    // linha some pela ponta de FORA e o último pedaço visível é o do centro.
    // Absorvida, não apagada.
    const css = FONTE(CSS);
    const quadro = css.slice(css.indexOf('@keyframes tracoDeConexao'));
    const bloco = quadro.slice(0, quadro.indexOf('\n}'));
    expect(
      /stroke-dashoffset:\s*-\d/.test(bloco),
      'O traço voltou a DESBOTAR em vez de drenar.\n'
      + '  Sem `dashoffset` negativo ele chega ao centro e fica parado perdendo\n'
      + '  opacidade — e como os cinco têm atrasos diferentes, sobram pedaços\n'
      + '  fracos de várias linhas no meio ao mesmo tempo. Foi exatamente isso\n'
      + '  que o dono chamou de "pontos estranhos ali no meio".',
    ).toBe(true);
  });

  it('a opacidade não faz o trabalho de apagar', () => {
    // A trava do desbotamento longo: entre o quadro em que o traço está
    // INTEIRO (dashoffset 0) e o quadro em que ele começa a sumir, a opacidade
    // precisa continuar em 1 — quem apaga é a geometria.
    const css = FONTE(CSS);
    const quadro = css.slice(css.indexOf('@keyframes tracoDeConexao'));
    const bloco = quadro.slice(0, quadro.indexOf('\n}'));

    const cheio = bloco.match(/(\d+)%\s*\{\s*stroke-dashoffset:\s*0(?:px)?;\s*opacity:\s*([\d.]+)/);
    expect(cheio, 'Não achei o quadro do traço INTEIRO — a trava ficaria vazia.').toBeTruthy();
    expect(
      Number(cheio[2]),
      `No instante em que o traço está inteiro (${cheio[1]}%) a opacidade já é `
      + `${cheio[2]}.\n`
      + '  Ele precisa chegar ao centro em opacidade CHEIA e sumir pela\n'
      + '  geometria. Opacidade caindo com o traço inteiro é o desbotamento\n'
      + '  parado que produziu os "pontos estranhos".',
    ).toBe(1);
  });

  it('toda linha mede o MESMO comprimento para o tracejado', () => {
    // `[12/09]` *"Tem uma verde que parou no meio da trajetória."*
    //
    // `stroke-dasharray` é medido em unidades do `viewBox`, e as cinco linhas
    // têm comprimentos reais diferentes (~26 a ~42). Com
    // `preserveAspectRatio="none"` o `viewBox` ainda é esticado DESIGUALMENTE,
    // então o comprimento efetivo muda com a proporção da tela.
    expect(
      /pathLength="100"/.test(FONTE(SINAIS)),
      'As ligações perderam o `pathLength="100"`.\n'
      + '  Sem ele, o `stroke-dasharray: 100` do CSS significa uma fração\n'
      + '  diferente em cada linha — e muda de novo conforme a proporção da\n'
      + '  tela, porque o SVG não preserva o aspecto. O sintoma é uma linha\n'
      + '  desenhando até o meio e parando.',
    ).toBe(true);
  });
});
