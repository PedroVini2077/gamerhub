import * as PECAS from './pecasDeJogo';

/**
 * As peças de videogame que atravessam o fundo do site logado.
 *
 * ── O que ela é, e por que ela existe só aqui ───────────────────────────────
 *
 * Pedido do dono em 02/09: *"vamos manter essa animação no site logado, mas
 * quero outras coisas lá, diferentes do resto... nem que seja controles de
 * vídeo game"*.
 *
 * Ela **soma** ao fluxo de dados que já existe, em vez de substituí-lo: o
 * fluxo é a assinatura compartilhada com a landing, e as peças são o que
 * separa o site logado do resto. Duas camadas, dois papéis.
 *
 * ── O custo, e por que ele é o mesmo de zero ────────────────────────────────
 *
 * Só `transform` e `opacity`, animados por CSS. O navegador roda isso no
 * compositor, fora da thread principal — nenhum laço de JavaScript por quadro.
 * Foi exatamente esse tipo de laço que custou 29.441 ms de thread na cena 3D
 * (§0.3), e a lição virou regra de casa.
 *
 * ── As três regras que enfeite obedece neste projeto ────────────────────────
 *
 * 1. `pointer-events-none` — nunca rouba clique do conteúdo;
 * 2. `motion-reduce:hidden` — movimento de fundo dispara enjoo em quem tem
 *    sensibilidade vestibular, e quem pediu menos movimento pediu por isso;
 * 3. `aria-hidden` — leitor de tela não anuncia decoração.
 */

/**
 * A disposição das peças. Fixa, e não sorteada a cada render.
 *
 * `Math.random()` no render produziria posição nova a cada atualização de
 * estado — as peças saltariam pela tela toda vez que um post chegasse. O que
 * dá a sensação de aleatório aqui é cada peça ter duração, atraso e deriva
 * próprios: os ciclos nunca fecham juntos, então o conjunto não se repete de
 * forma visível.
 *
 * ── `[03/09]` A primeira calibragem estava invisível, e foi MEDIDA ──────────
 *
 * Relato do dono: *"não tô vendo os itens animados ao fundo que vc disse que
 * fez, acho que não subiu o commit"*. O commit tinha subido e o componente
 * renderizava — o defeito era de calibragem, não de código, e é pior por isso:
 * nada quebra, nenhum teste falha, e a entrega simplesmente **não existe** para
 * quem olha.
 *
 * Medido num Chromium de verdade, desenhando a mesma peça em cada opacidade
 * sobre `#0a0a0a`: a 0,09–0,17 o contorno de 1,4 px some no fundo; a partir de
 * ~0,30 ele lê. Três coisas mudaram juntas, porque as três somavam para o
 * mesmo efeito:
 *
 * | | Antes | Agora | Por quê |
 * | --- | --- | --- | --- |
 * | opacidade | 0,09–0,17 | **0,21–0,34** | era a causa principal — contorno fino a 10% não existe |
 * | tamanho | 28–56 px | **38–76 px** | peça pequena some junto com o traço |
 * | duração | 68–112 s | **46–80 s** | a 78 s a peça anda ~1,3 tela; em 10 s de olhada ela mal se move, e o que não se move não é notado |
 * | quantidade | 6 | **8** | tudo no compositor, então o custo continua o mesmo |
 *
 * **O teto continua sendo o texto.** O objetivo é ambientar, não competir — o
 * dono pediu *"só não deixa feio"*. Por isso parou em ~0,34 e não em 0,45, que
 * já disputa atenção com o conteúdo do feed.
 */
const POSICOES = [
  { x: '6%',  tamanho: 62, duracao: 36, atraso: -8,  deriva: '5vw',  giro: '38deg',  pico: 0.52 },
  { x: '19%', tamanho: 40, duracao: 30, atraso: -34, deriva: '-4vw', giro: '-26deg', pico: 0.42 },
  { x: '32%', tamanho: 76, duracao: 46, atraso: -20, deriva: '3vw',  giro: '52deg',  pico: 0.58 },
  { x: '45%', tamanho: 46, duracao: 34, atraso: -50, deriva: '-6vw', giro: '30deg',  pico: 0.40 },
  { x: '58%', tamanho: 66, duracao: 38, atraso: -14, deriva: '4vw',  giro: '-44deg', pico: 0.54 },
  { x: '70%', tamanho: 38, duracao: 52, atraso: -62, deriva: '-3vw', giro: '22deg',  pico: 0.40 },
  { x: '82%', tamanho: 70, duracao: 50, atraso: -28, deriva: '6vw',  giro: '-34deg', pico: 0.56 },
  { x: '93%', tamanho: 44, duracao: 44, atraso: -44, deriva: '-5vw', giro: '46deg',  pico: 0.44 },
];

export default function PecasFlutuantes({ elenco = [], acento }) {
  if (!elenco.length) return null;

  return (
    <div
      aria-hidden="true"
      // `camada-de-fundo` é `100lvh` e não `100vh`: no celular a barra de
      // endereço some ao rolar, a janela cresce, e toda medida em `vh` é
      // recalculada de uma vez — foi assim que as formas da "Sobre" davam um
      // pulo em 01/09. Ver `index.css`.
      className="camada-de-fundo fixed top-0 left-0 w-full z-0 overflow-hidden
                 pointer-events-none motion-reduce:hidden"
      style={{ color: acento }}
    >
      {POSICOES.map((p, i) => {
        // O elenco tem 2 ou 3 peças e as posições são 6: o resto cicla, então
        // cada peça aparece mais de uma vez em tamanhos e ritmos diferentes.
        const Peca = PECAS[elenco[i % elenco.length]];
        if (!Peca) return null;
        return (
          <span
            key={i}
            className="peca-de-jogo"
            style={{
              left: p.x,
              width: `${p.tamanho}px`,
              height: `${p.tamanho}px`,
              animationDuration: `${p.duracao}s`,
              animationDelay: `${p.atraso}s`,
              '--deriva': p.deriva,
              '--giro': p.giro,
              '--pico': p.pico,
            }}
          >
            <Peca />
          </span>
        );
      })}
    </div>
  );
}
