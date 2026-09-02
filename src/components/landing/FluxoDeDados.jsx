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
  { x: '3%',  altura: 24, duracao: 21, atraso: -5,  cor: '#22d3ee', opacidade: 0.18, profundidade: 0.2 },
  { x: '6%',  altura: 34, duracao: 13, atraso: -2,  cor: '#39ff14', opacidade: 0.30, profundidade: 0.5 },
  { x: '11%', altura: 58, duracao: 9,  atraso: -3,  cor: '#39ff14', opacidade: 0.34, profundidade: 0.9, pacote: true },
  { x: '14%', altura: 20, duracao: 19, atraso: -11, cor: '#22d3ee', opacidade: 0.20, profundidade: 0.2 },
  { x: '19%', altura: 30, duracao: 24, atraso: -16, cor: '#a855f7', opacidade: 0.16, profundidade: 0.3 },
  { x: '23%', altura: 46, duracao: 16, atraso: -6,  cor: '#39ff14', opacidade: 0.24, profundidade: 0.8 },
  { x: '27%', altura: 14, duracao: 18, atraso: -13, cor: '#22d3ee', opacidade: 0.20, profundidade: 0.4 },
  { x: '31%', altura: 16, duracao: 22, atraso: -17, cor: '#a855f7', opacidade: 0.18, profundidade: 0.3 },
  { x: '37%', altura: 62, duracao: 10, atraso: -7,  cor: '#22d3ee', opacidade: 0.32, profundidade: 0.9, pacote: true },
  { x: '43%', altura: 28, duracao: 15, atraso: -9,  cor: '#39ff14', opacidade: 0.22, profundidade: 0.6 },
  { x: '47%', altura: 38, duracao: 26, atraso: -22, cor: '#39ff14', opacidade: 0.15, profundidade: 0.2 },
  { x: '52%', altura: 40, duracao: 25, atraso: -21, cor: '#22d3ee', opacidade: 0.16, profundidade: 0.4 },
  { x: '57%', altura: 22, duracao: 17, atraso: -10, cor: '#a855f7', opacidade: 0.20, profundidade: 0.5 },
  { x: '61%', altura: 22, duracao: 17, atraso: -4,  cor: '#39ff14', opacidade: 0.28, profundidade: 0.9 },
  { x: '66%', altura: 54, duracao: 11, atraso: -1,  cor: '#a855f7', opacidade: 0.30, profundidade: 0.8, pacote: true },
  { x: '70%', altura: 52, duracao: 20, atraso: -14, cor: '#a855f7', opacidade: 0.20, profundidade: 0.5 },
  { x: '75%', altura: 18, duracao: 27, atraso: -24, cor: '#22d3ee', opacidade: 0.15, profundidade: 0.2 },
  { x: '79%', altura: 18, duracao: 14, atraso: -8,  cor: '#39ff14', opacidade: 0.24, profundidade: 0.7 },
  { x: '84%', altura: 32, duracao: 19, atraso: -15, cor: '#39ff14', opacidade: 0.19, profundidade: 0.4 },
  { x: '88%', altura: 36, duracao: 23, atraso: -19, cor: '#22d3ee', opacidade: 0.18, profundidade: 0.3 },
  { x: '92%', altura: 60, duracao: 12, atraso: -6,  cor: '#39ff14', opacidade: 0.30, profundidade: 0.9, pacote: true },
  { x: '95%', altura: 26, duracao: 18, atraso: -12, cor: '#39ff14', opacidade: 0.22, profundidade: 0.6 },
  { x: '98%', altura: 20, duracao: 22, atraso: -18, cor: '#a855f7', opacidade: 0.16, profundidade: 0.3 },
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

/**
 * @param {object} props
 * @param {string|null} [props.acento] Cor única, no lugar das três da landing.
 *   Usada pelo site logado, onde cada seção tem a sua — ver `acentoDaSecao`.
 * @param {boolean} [props.parallax] Ligar o deslocamento por ponteiro e por
 *   rolagem. **Desligado no site logado de propósito**: os dois custam +296 ms
 *   e +451 ms medidos durante movimento contínuo (ver DESEMPENHO.md), e o feed
 *   é a tela onde mais se rola. Sem eles a camada custa **zero** medido.
 *
 * ── `[02/09]` Por que o site logado reusa ESTE componente ───────────────────
 *
 * Decisão do dono: o mesmo fundo em todas as abas, variando só a cor. Fazer um
 * segundo componente "parecido" seria criar a segunda fonte de verdade que o §4
 * proíbe — e ela divergiria em desempenho, `prefers-reduced-motion` e no
 * conserto do `100lvh`, que já custou um bug de salto no celular.
 */
export default function FluxoDeDados({ acento = null, parallax = true }) {
  const camada = useRef(null);

  useEffect(() => {
    const alvo = camada.current;
    if (!parallax) return undefined;
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
  }, [parallax]);

  // ── `[02/09]` Parallax de ROLAGEM ─────────────────────────────────────────
  //
  // O dono notou que, ao rolar, o fundo "parece que para no tempo". Ele estava
  // certo em perceber, e errado sobre a causa: medi, e a animação continua
  // rodando durante a rolagem. O que acontece é a camada ser `fixed` — o
  // conteúdo sobe e as peças ficam no mesmo ponto da TELA, o que lê como
  // descolado do mundo.
  //
  // A correção não é tirar o `fixed` (aí as peças só existiriam no rodapé de
  // uma página de 5.000 px): é deslocá-las um pouco CONTRA a rolagem. Elas
  // passam a responder ao movimento da página sem sair da tela — é o que dá a
  // sensação de profundidade em vez de adesivo colado no vidro.
  //
  // Mesmo desenho barato do ponteiro: um ouvinte, uma variável CSS, coalescido
  // por quadro. Nada de laço por frame.
  useEffect(() => {
    const alvo = camada.current;
    if (!alvo || !parallax) return undefined;

    let agendado = false;
    const aplicar = () => {
      agendado = false;
      // Divisor alto de propósito: 3.000 px de rolagem viram 1 unidade. O
      // deslocamento tem que ser sentido, não visto.
      alvo.style.setProperty('--rolagem', String(window.scrollY / 3000));
    };
    const aoRolar = () => {
      if (!agendado) { agendado = true; requestAnimationFrame(aplicar); }
    };

    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, [parallax]);

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
      style={{
        '--desvio': 0,
        '--rolagem': 0,
        // A rolagem move a camada INTEIRA, num elemento só e SEM transição.
        // Um `translate` composto por quadro é o que o navegador já faz para
        // rolar a página — some no ruído. Espalhado pelos três grupos COM
        // transição, virava três transições reiniciadas por quadro.
        translate: '0 calc(var(--rolagem) * 70px)',
        willChange: 'transform',
      }}
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
            // SÓ o ponteiro aqui. A rolagem foi para o elemento raiz, e a
            // separação é medida, não estética:
            //
            // a `transition` existe para o ponteiro — ela suaviza saltos de um
            // evento discreto. Mas ela era REINICIADA a cada quadro de rolagem,
            // e rolagem é contínua: o navegador ficava recomeçando três
            // transições por quadro enquanto a página se move. Jank durante
            // scroll é o mais perceptível que existe.
            //
            // Rolagem não precisa de suavização: ela já é o movimento.
            translate: `calc(var(--desvio) * ${grupo.profundidade * 22}px) 0`,
            transition: 'translate 320ms ease-out',
            willChange: 'transform',
          }}
        >
          {grupo.tracos.map((t, i) => (
            <span
              key={i}
              className={`absolute bottom-0 animate-subir-dado ${t.pacote ? 'w-0.5' : 'w-px'}`}
              style={{
                left: t.x,
                height: `${t.altura}px`,
                opacity: t.opacidade,
                background: `linear-gradient(to top, transparent, ${acento ?? t.cor})`,
                // O "pacote" é mais largo, mais brilhante e mais rápido — lê
                // como um dado maior passando, e quebra a regularidade sem
                // precisar de um efeito diferente. Um tipo de elemento só,
                // dois pesos: é o que mantém a cena coerente em vez de virar
                // coleção de truques.
                boxShadow: `0 0 ${t.pacote ? 12 : 6}px ${acento ?? t.cor}`,
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
