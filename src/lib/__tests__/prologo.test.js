import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALTURA_DO_PROLOGO, JANELAS, ATOS, FRASE_DO_ATO_ZERO } from '../atosDaLanding';

/**
 * As travas do PRÓLOGO — a narrativa por rolagem da landing.
 *
 * `[12/09]` Todas as falhas abaixo têm a mesma assinatura, que é a razão de
 * existirem: **a página continua abrindo, nada estoura, e um ato simplesmente
 * não acontece**. Narrativa é um contrato entre números (as janelas) e
 * mecanismo (o `sticky`), e contrato entre duas coisas diverge sozinho.
 */

const FONTE = (c) => readFileSync(c, 'utf8');
const PROLOGO = 'src/components/landing/PrologoDaLanding.jsx';
const PALCO = 'src/components/landing/PalcoDeRolagem.jsx';
const PARADO = 'src/components/landing/PrologoParado.jsx';
const LANDING = 'src/pages/Landing.jsx';

describe('o roteiro dos atos', () => {
  it('nenhuma janela cai fora da rolagem que existe', () => {
    for (const [nome, [entra, sai]] of Object.entries(JANELAS)) {
      expect(
        entra >= 0 && sai <= 1,
        `A janela \`${nome}\` = [${entra}, ${sai}] sai da faixa 0–1.\n`
        + '  O progresso do palco NUNCA passa de 1: uma janela que começa em 1,2\n'
        + '  descreve um ato que jamais acontece. E ele não falha — ele apenas\n'
        + '  não aparece, o que é indistinguível de "não foi implementado".',
      ).toBe(true);
      expect(
        entra < sai,
        `A janela \`${nome}\` = [${entra}, ${sai}] está invertida ou vazia.\n`
        + '  `useTransform` com faixa invertida devolve o valor final o tempo\n'
        + '  todo: a camada nasce no estado de saída e nunca se move.',
      ).toBe(true);
    }
  });

  it('o último ato CHEGA em 1 — senão o hero fica semitransparente para sempre', () => {
    // Esta é a falha mais cara da lista, porque ela é permanente: se a janela
    // do hero terminar em 0,94, os últimos 6% da rolagem já soltaram a cena
    // presa e o hero para de subir a opacidade no meio. A pessoa fica com um
    // hero a 70%, sem nada para clicar que resolva, e sem erro nenhum.
    expect(
      JANELAS.hero[1],
      'A janela do hero não termina em 1.\n'
      + '  O ato GAMERHUB é o último: ele precisa estar COMPLETO no instante em\n'
      + '  que o palco solta. Terminar antes deixa sobra parada; terminar depois\n'
      + '  deixa o hero incompleto para sempre.',
    ).toBe(1);
  });

  it('o ATO 0 não tem hero por cima — é a regra 1 do dono', () => {
    // *"a arte quase em tela cheia, SEM o logo do GamerHub por cima, SEM o
    // parágrafo atual do hero, SEM CTA imediato"*. Em progresso 0 é onde a
    // pessoa chega, então é ali que a regra vale.
    expect(
      JANELAS.hero[0],
      'A janela do hero começa cedo demais: em progresso 0 ele já estaria\n'
      + '  aparecendo por cima da arte, que é exatamente o que o ATO 0 proíbe.',
    ).toBeGreaterThan(0.5);
    expect(
      JANELAS.marca[0],
      'A marca começa a aparecer antes da metade da narrativa.\n'
      + '  O arco pedido termina em MARCA -> GAMERHUB: marca visível no ATO 0\n'
      + '  entrega o fim da história na primeira tela.',
    ).toBeGreaterThan(0.5);
  });

  it('cada ato declarado tem uma janela que o cobre', () => {
    // Sem isto, acrescentar um ato à lista (que é o que se lê para entender o
    // desenho) sem acrescentar a janela produz um documento que promete cinco
    // atos e uma tela que mostra quatro.
    const faixas = Object.values(JANELAS);
    for (const ato of ATOS) {
      const coberto = faixas.some(([a, b]) => ato.pico >= a && ato.pico <= b)
        || ato.pico >= JANELAS.hero[0];
      expect(
        coberto,
        `O ato ${ato.rotulo} (pico ${ato.pico}) não cai em janela nenhuma.\n`
        + '  Ele está escrito na lista de atos e não acontece na tela.',
      ).toBe(true);
    }
  });

  it('a altura do palco dá espaço aos atos', () => {
    // Cinco atos e dois respiros em menos de três telas viram um susto só. O
    // número não tem valor "certo" — o que não pode é cair sem ninguém notar.
    expect(
      ALTURA_DO_PROLOGO,
      'O prólogo encolheu para menos de 3 telas de rolagem.\n'
      + '  Os cinco atos continuam lá, espremidos: cada um passa em um piscar,\n'
      + '  e o respiro que o dono pediu deixa de existir. Nada quebra.',
    ).toBeGreaterThanOrEqual(300);
  });
});

describe('o mecanismo', () => {
  it('o palco PRENDE a cena — sem `sticky` não há narrativa', () => {
    const palco = FONTE(PALCO);
    // A CLASSE, não a palavra: o arquivo explica `position: sticky` num
    // comentário, e `/sticky/` no texto inteiro aprovava um palco que tinha
    // perdido a classe. Provado reinjetando o bug — a primeira versão desta
    // trava passou verde com `absolute top-0` no lugar.
    expect(
      /className=\{?[`"]sticky top-0/.test(palco),
      'O `PalcoDeRolagem` perdeu o `sticky top-0`.\n'
      + '  Sem prender, o bloco de 360vh apenas passa: os cinco atos acontecem\n'
      + '  em frações de segundo enquanto a tela sobe, e a landing vira um\n'
      + '  borrão. A página continua funcionando — esse é o problema.',
    ).toBe(true);
    expect(
      palco,
      'O palco voltou a medir a altura em `vh`.\n'
      + '  No celular a barra de endereço some ao rolar e a janela CRESCE: com\n'
      + '  `vh` a cena presa muda de altura no meio do movimento. É a mesma\n'
      + '  lição de 01/09 que fez as formas da "Sobre" darem um pulo.',
      // De novo a classe e não a palavra, pelo mesmo motivo do `sticky`: o
      // comentário do arquivo cita `100svh` ao explicar a escolha.
    ).toMatch(/className=\{?[`"]sticky top-0 h-\[100svh\]/);
  });

  it('não entrou biblioteca de rolagem — o palco usa o que já existe', () => {
    const palco = FONTE(PALCO);
    // Só as linhas de `import`: o arquivo CITA o GSAP no comentário que explica
    // por que ele não entrou, e uma varredura do texto inteiro reprovaria a
    // própria justificativa.
    const importa = palco.match(/^\s*import .*$/gm)?.join('\n') ?? '';
    expect(
      /gsap|ScrollTrigger|locomotive|lenis/i.test(importa),
      'O palco passou a depender de uma biblioteca de rolagem.\n'
      + '  GSAP + ScrollTrigger custam ~70 kB DESCOMPACTADOS no caminho crítico\n'
      + '  para fazer o que `position: sticky` faz de graça, e o pin deles\n'
      + '  reescreve o layout — que briga com o `FluxoDeDados`, que é `fixed`.\n'
      + '  Se houver motivo real, ele precisa estar escrito aqui e no PR.',
    ).toBe(false);
    expect(palco).toContain('useScroll');
  });

  it('quem pediu menos movimento continua vendo a landing INTEIRA', () => {
    const prologo = FONTE(PROLOGO);
    // O DESVIO, não os nomes: `import` e comentário mantêm as duas palavras no
    // arquivo mesmo depois de alguém apagar o `if`. Provado reinjetando —
    // a primeira versão desta trava passou verde com o desvio desligado.
    expect(
      /if \(menosMovimento\) return <PrologoParado/.test(prologo),
      'O prólogo deixou de olhar `prefers-reduced-motion`.\n'
      + '  Narrativa conduzida por rolagem é justamente o formato que mais\n'
      + '  incomoda quem tem sensibilidade vestibular. E o silêncio aqui é\n'
      + '  total: essa pessoa não reclama, ela fecha a aba.',
    ).toBe(true);

    const parado = FONTE(PARADO);
    expect(
      parado.includes('FRASE_DO_ATO_ZERO') && parado.includes('CENAS.hero'),
      'A versão sem movimento perdeu a arte ou a frase do ATO 0.\n'
      + '  Elas são CONTEÚDO, não efeito: entregar a landing sem elas para quem\n'
      + '  desligou animação é trocar acessibilidade por decoração.',
    ).toBe(true);
  });

  it('o hero invisível não é clicável', () => {
    // Enquanto o ato GAMERHUB não chegou, a coluna do hero está a opacidade 0 e
    // tem dois links dentro. Sem a trava, eles continuam recebendo clique e Tab:
    // um botão invisível que leva ao login é armadilha, não decoração.
    expect(
      FONTE(PROLOGO),
      'O prólogo deixou de desligar o clique do hero invisível.\n'
      + '  Opacidade 0 não desliga ponteiro nem foco de teclado: quem navega por\n'
      + '  Tab cai num link que não existe na tela.',
    ).toContain('pointerEvents');
  });

  it('a arte do hero é REALMENTE usada — ela já ficou mapeada sem chamador', () => {
    // Aconteceu: `CENAS.hero` existia no mapa, com as seis variantes geradas, e
    // não era renderizada em lugar nenhum. Nada acusa uma arte órfã.
    const usada = [PROLOGO, PARADO].some((c) => FONTE(c).includes('CENAS.hero'));
    expect(
      usada,
      'Nenhum componente do prólogo usa `CENAS.hero`.\n'
      + '  A arte de abertura voltou a ser um arquivo gerado que ninguém mostra.',
    ).toBe(true);
    expect(
      FONTE(LANDING),
      'A `Landing` deixou de montar o prólogo.',
    ).toContain('<PrologoDaLanding');
  });

  it('a frase do ATO 0 é a que o dono escreveu', () => {
    expect(FRASE_DO_ATO_ZERO).toBe('Tudo o que acontece entre gamers, em um só lugar.');
  });
});
