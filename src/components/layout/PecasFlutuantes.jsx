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
 */
const POSICOES = [
  { x: '8%',  tamanho: 46, duracao: 78, atraso: -12, deriva: '5vw',  giro: '38deg',  pico: 0.15 },
  { x: '23%', tamanho: 30, duracao: 96, atraso: -48, deriva: '-4vw', giro: '-26deg', pico: 0.11 },
  { x: '41%', tamanho: 56, duracao: 68, atraso: -30, deriva: '3vw',  giro: '52deg',  pico: 0.17 },
  { x: '58%', tamanho: 34, duracao: 104, atraso: -70, deriva: '-6vw', giro: '30deg', pico: 0.10 },
  { x: '74%', tamanho: 48, duracao: 84, atraso: -20, deriva: '4vw',  giro: '-44deg', pico: 0.14 },
  { x: '90%', tamanho: 28, duracao: 112, atraso: -88, deriva: '-3vw', giro: '22deg', pico: 0.09 },
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
