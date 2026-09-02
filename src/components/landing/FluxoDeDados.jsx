import { useEffect, useRef } from 'react';

/**
 * O fluxo de dados que sobe atrás da landing.
 *
 * ── O que ele é, e por que não é "mais uma decoração" ───────────────────────
 *
 * Traços finos de luz subindo devagar, como pacote de dado atravessando uma
 * rede. Combina com o resto sem competir: a cena 3D é o objeto em foco, o
 * fundo da "Sobre" são formas grandes e lentas, e isto é fino, numeroso e
 * vertical — lê como infraestrutura, não como enfeite solto.
 *
 * ── A parte difícil: interatividade SEM laço por quadro ─────────────────────
 *
 * O pedido incluía "algum nível de interatividade". O caminho óbvio — mover
 * cada traço no `requestAnimationFrame` — é exatamente o custo que encareceu a
 * cena 3D (§0.3): trabalho de CPU a cada quadro, para sempre, mesmo parado.
 *
 * O que este componente faz:
 *
 * | | |
 * | --- | --- |
 * | um ÚNICO ouvinte de ponteiro | não um por elemento |
 * | escreve UMA variável CSS | não estado do React, que re-renderizaria tudo |
 * | coalescido por `requestAnimationFrame` | vários eventos viram uma escrita |
 * | só roda ENQUANTO o ponteiro se move | parado, custa exatamente zero |
 *
 * O deslocamento em si acontece no CSS, no compositor. O JavaScript só informa
 * "o ponteiro está aqui" — ele não anima nada.
 *
 * ── Acessibilidade e celular ────────────────────────────────────────────────
 *
 * `motion-reduce:hidden` some por completo para quem pediu menos movimento.
 * No celular não há ponteiro: o parallax simplesmente não acontece, e os
 * traços sobem igual — nada quebra, e nada fica esperando um evento que não vem.
 */

/**
 * Cada traço com posição, duração e atraso próprios.
 *
 * Durações que não são múltiplas entre si: os ciclos demoram muito para
 * coincidir, então o conjunto não "pulsa" junto. O atraso NEGATIVO faz cada um
 * já entrar no meio do caminho — sem ele a tela começaria vazia e tudo
 * apareceria de uma vez.
 *
 * `profundidade` controla o quanto o traço reage ao ponteiro: os mais fracos
 * (fundo) andam menos que os mais fortes (frente). É o que cria a sensação de
 * camada em vez de um plano só deslizando.
 */
const TRACOS = [
  { x: '6%',  altura: 34, duracao: 13, atraso: -2,  cor: '#39ff14', opacidade: 0.30, profundidade: 0.5 },
  { x: '14%', altura: 20, duracao: 19, atraso: -11, cor: '#22d3ee', opacidade: 0.20, profundidade: 0.2 },
  { x: '23%', altura: 46, duracao: 16, atraso: -6,  cor: '#39ff14', opacidade: 0.24, profundidade: 0.8 },
  { x: '31%', altura: 16, duracao: 22, atraso: -17, cor: '#a855f7', opacidade: 0.18, profundidade: 0.3 },
  { x: '43%', altura: 28, duracao: 15, atraso: -9,  cor: '#39ff14', opacidade: 0.22, profundidade: 0.6 },
  { x: '52%', altura: 40, duracao: 25, atraso: -21, cor: '#22d3ee', opacidade: 0.16, profundidade: 0.4 },
  { x: '61%', altura: 22, duracao: 17, atraso: -4,  cor: '#39ff14', opacidade: 0.28, profundidade: 0.9 },
  { x: '70%', altura: 52, duracao: 20, atraso: -14, cor: '#a855f7', opacidade: 0.20, profundidade: 0.5 },
  { x: '79%', altura: 18, duracao: 14, atraso: -8,  cor: '#39ff14', opacidade: 0.24, profundidade: 0.7 },
  { x: '88%', altura: 36, duracao: 23, atraso: -19, cor: '#22d3ee', opacidade: 0.18, profundidade: 0.3 },
  { x: '95%', altura: 26, duracao: 18, atraso: -12, cor: '#39ff14', opacidade: 0.22, profundidade: 0.6 },
];

/**
 * Os traços agrupados em três planos de profundidade.
 *
 * Só o contêiner de cada grupo lê a variável do ponteiro — três elementos
 * reagindo em vez de onze. A `profundidade` é a do grupo; o campo original de
 * cada traço vira apenas o critério de qual grupo ele pertence.
 */
const GRUPOS = [
  { profundidade: 0.25, tracos: TRACOS.filter(t => t.profundidade <= 0.35) },
  { profundidade: 0.55, tracos: TRACOS.filter(t => t.profundidade > 0.35 && t.profundidade <= 0.65) },
  { profundidade: 0.9,  tracos: TRACOS.filter(t => t.profundidade > 0.65) },
];

export default function FluxoDeDados() {
  const camada = useRef(null);

  useEffect(() => {
    const alvo = camada.current;
    // Sem ponteiro fino (celular) o parallax não faz sentido: não há para onde
    // apontar. Não registrar o ouvinte é melhor do que registrá-lo e nunca usar.
    if (!alvo || !window.matchMedia?.('(pointer: fine)').matches) return undefined;

    let agendado = false;
    let ultimoX = 0;

    const aplicar = () => {
      agendado = false;
      // −1 a 1: o quanto o ponteiro está à esquerda ou à direita do centro.
      alvo.style.setProperty('--desvio', String(ultimoX));
    };

    const aoMover = (e) => {
      ultimoX = (e.clientX / window.innerWidth) * 2 - 1;
      // Coalescer é o ponto: o navegador dispara `pointermove` muitas vezes por
      // quadro, e escrever a variável em todas seria trabalho jogado fora.
      if (!agendado) { agendado = true; requestAnimationFrame(aplicar); }
    };

    window.addEventListener('pointermove', aoMover, { passive: true });
    return () => window.removeEventListener('pointermove', aoMover);
  }, []);

  return (
    <div
      ref={camada}
      aria-hidden="true"
      // `fixed` + `camada-de-fundo` (que é `100lvh`), e não `absolute`:
      //
      // 1. `absolute` numa página de ~5.000 px faria a camada ter essa altura
      //    inteira, e os traços — que nascem no rodapé dela — só apareceriam
      //    quando alguém rolasse até o fim.
      // 2. `100lvh` em vez de `100vh` é a lição de 01/09: no celular a barra de
      //    endereço some ao rolar, a janela cresce, e toda medida em `vh` é
      //    recalculada de uma vez. Foi assim que as formas da "Sobre" davam um
      //    pulo — ver `index.css`.
      className="camada-de-fundo fixed top-0 left-0 w-full z-0 overflow-hidden
                 pointer-events-none motion-reduce:hidden"
      style={{ '--desvio': 0 }}
    >
      {/* ── Os traços vão em GRUPOS por profundidade, e isso foi medido ─────
          Na primeira versão cada traço lia `--desvio` direto. Custava +714 ms
          de thread principal enquanto o ponteiro varria a tela (A/B com CPU a
          1/4, contra a mesma página sem a camada), porque cada atualização da
          variável invalidava o estilo dos ONZE traços e disparava onze
          transições.
          Agrupando, só os TRÊS contêineres leem a variável — os traços dentro
          nem sabem que ela existe. O efeito de camada continua, e o custo cai
          para um terço dos elementos. Ver DESEMPENHO.md. */}
      {GRUPOS.map(grupo => (
        <div
          key={grupo.profundidade}
          className="absolute inset-0"
          style={{
            translate: `calc(var(--desvio) * ${grupo.profundidade * 22}px) 0`,
            transition: 'translate 320ms ease-out',
            willChange: 'transform',
          }}
        >
          {grupo.tracos.map((t, i) => (
            <span
              key={i}
              className="absolute bottom-0 w-px animate-subir-dado"
              style={{
                left: t.x,
                height: `${t.altura}px`,
                opacity: t.opacidade,
                background: `linear-gradient(to top, transparent, ${t.cor})`,
                boxShadow: `0 0 6px ${t.cor}`,
                animationDuration: `${t.duracao}s`,
                animationDelay: `${t.atraso}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
