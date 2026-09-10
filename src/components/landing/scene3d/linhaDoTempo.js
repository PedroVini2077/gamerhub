// A timeline central da cena — UM relógio, um estado, todos os objetos lendo.
//
// ── O problema que ela resolve, na frase do dono ────────────────────────────
//
// *"GSAP se ajudar a criar uma timeline central e controlada — evitar dezenas
// de `useFrame()` independentes e descoordenados"*.
//
// **A crítica está certa e a cena antiga era exatamente isso:** `LogoBolt`
// tinha o próprio `useFrame` acumulando tempo, cada `GemModel` tinha o seu, e
// o `useBob` tinha outro. Nada garantia que dois objetos concordassem sobre em
// que instante da cena eles estavam.
//
// ── Por que NÃO entrou o GSAP ───────────────────────────────────────────────
//
// Porque o conserto é a **timeline**, não a biblioteca — e a timeline cabe
// neste arquivo. O GSAP custaria ~25 kB gzip para substituir ~40 linhas de
// interpolação, e o próprio pedido dele diz *"não adicione bibliotecas apenas
// porque são tecnicamente interessantes; cada dependência precisa ter
// justificativa"*.
//
// O que o GSAP traria de verdade e não temos: easing pronto, `stagger`,
// controle externo (scrub, seek). Nada disso é necessário aqui — a cena toca
// uma vez, do começo ao repouso, e nunca é rebobinada.
//
// ── O relógio é acumulado do `delta`, e isso NÃO é preciosismo ──────────────
//
// O `@react-three/fiber` **zera** `clock.elapsedTime` a cada troca de
// `frameloop`, e a cena troca toda vez que sai e volta para a viewport (o
// `IntersectionObserver`). Ler o relógio da cena faria a animação saltar para o
// começo quando alguém rolasse a página e voltasse. O projeto já tomou esse
// bug uma vez — está registrado em `lib/ritmoDoRaio.js`.

/**
 * As nove fases, na ordem que o dono definiu.
 *
 * `ate` é o instante em que a fase TERMINA, em segundos desde a montagem.
 * Guardar o fim (e não a duração) deixa a leitura direta: para saber onde a
 * cena está aos 2,4 s, procura-se a primeira linha com `ate` maior.
 */
export const FASES = [
  { nome: 'vazio',           ate: 0.35 },
  { nome: 'vortice',         ate: 1.15 },
  { nome: 'convergencia',    ate: 1.85 },
  { nome: 'nucleo',          ate: 2.35 },
  { nome: 'metades',         ate: 3.40 },
  { nome: 'fragmentos',      ate: 4.20 },
  { nome: 'estabilizacao',   ate: 4.90 },
  { nome: 'pulso',           ate: 5.45 },
  { nome: 'repouso',         ate: Infinity },
];

/** Quando a cena para de "entrar" e passa a só respirar. */
export const FIM_DA_ENTRADA = 5.45;

const suave = (t) => t * t * (3 - 2 * t);
const saidaCubica = (t) => 1 - (1 - t) ** 3;
const saidaCostas = (t) => {
  const c = 1.70158 + 1;
  return 1 + c * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
};

/** Progresso 0..1 dentro de uma janela, com corte nas pontas. */
function janela(t, de, ate) {
  if (ate <= de) return t >= ate ? 1 : 0;
  return Math.min(1, Math.max(0, (t - de) / (ate - de)));
}

/**
 * O estado da cena num instante — o ÚNICO lugar onde "que horas são" vira
 * "como cada coisa deve estar".
 *
 * Devolve sempre o mesmo objeto mutado, e isso é de propósito: são ~60
 * chamadas por segundo, e alocar um objeto novo a cada quadro é lixo que o
 * coletor vai ter que recolher no meio da animação.
 */
export function criarLinhaDoTempo() {
  const estado = {
    tempo: 0,
    fase: 'vazio',
    entrando: true,
    // 0..1, quanto do raio já existe — o shader usa isto para se materializar
    materializacao: 0,
    // 0..1, a respiração do núcleo
    pulso: 0,
    // 0..1, o vórtice de entrada. Some quase por completo no repouso
    vortice: 0,
    // deslocamento das metades: sobe/desce no pulso
    afastamento: 0,
    // escala geral, para a peça "nascer"
    escala: 0,
    // 0..1, quanto os fragmentos já se aproximaram
    fragmentos: 0,
  };

  return {
    estado,

    /**
     * Avança o relógio e recalcula tudo.
     *
     * O `delta` vem com teto: se a aba ficar em segundo plano, o navegador
     * entrega um salto de vários segundos de uma vez, e sem o teto a cena
     * pularia a entrada inteira num quadro.
     */
    avancar(delta) {
      estado.tempo += Math.min(delta, 1 / 20);
      const t = estado.tempo;

      estado.fase = FASES.find((f) => t < f.ate)?.nome ?? 'repouso';
      estado.entrando = t < FIM_DA_ENTRADA;

      // ── vórtice: nasce, cresce, converge e some ────────────────────────
      const nasce = janela(t, 0.35, 1.15);
      const some = janela(t, 1.85, 3.40);
      estado.vortice = suave(nasce) * (1 - suave(some)) * 0.85
        // No repouso ele NÃO zera — fica um resíduo, senão a cena morre.
        + 0.06 * suave(janela(t, 3.40, 4.90));

      // ── núcleo: aparece antes das metades, porque ele é a FONTE ────────
      const nucleoNasce = janela(t, 1.85, 2.35);
      estado.escala = saidaCostas(nucleoNasce);

      // ── metades: materializam de baixo para cima ───────────────────────
      estado.materializacao = saidaCubica(janela(t, 2.35, 3.40));

      // ── fragmentos: chegam depois, e por último ────────────────────────
      estado.fragmentos = saidaCubica(janela(t, 3.40, 4.20));

      // ── o pulso ────────────────────────────────────────────────────────
      if (t < 4.90) {
        // Durante a entrada o núcleo já lateja, mas fraco.
        estado.pulso = 0.25 * suave(janela(t, 2.35, 4.90));
      } else if (t < 5.45) {
        // A ruptura controlada: UM pulso forte, e ele é o clímax.
        const p = janela(t, 4.90, 5.45);
        estado.pulso = 0.25 + Math.sin(p * Math.PI) * 0.75;
      } else {
        // Repouso: respiração lenta. É o "core é o coração da animação".
        estado.pulso = 0.28 + Math.sin((t - 5.45) * 1.15) * 0.22;
      }

      // As duas metades se afastam COM o pulso — é o que faz a energia
      // parecer empurrar a peça, em vez de o brilho só mudar de valor.
      estado.afastamento = estado.pulso * 0.055;

      return estado;
    },
  };
}
