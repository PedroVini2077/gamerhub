import { motion, useTransform, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import PalcoDeRolagem from './PalcoDeRolagem';
import ConvergenciaDoHub from './ConvergenciaDoHub';
import MarcaFlutuante from './MarcaFlutuante';
import ConteudoDoHero from './ConteudoDoHero';
import ArteDaCena from './ArteDaCena';
import PrologoParado from './PrologoParado';
import { CENAS } from '../../lib/cenasDaLanding';
import { OPACIDADE_NO_HERO } from '../../lib/marcaNoHero';
import { ALTURA_DO_PROLOGO, JANELAS, FRASE_DO_ATO_ZERO } from '../../lib/atosDaLanding';
import { heroFade } from '../../lib/landingMotion';

/**
 * O PRÓLOGO — os cinco atos que a rolagem conduz até o hero.
 *
 * ── O que o dono pediu, na letra ────────────────────────────────────────────
 *
 * *"ARTE → TRANSFORMAÇÃO → CONVERGÊNCIA → MARCA → GAMERHUB"*, com o ATO 0 sendo
 * a arte quase em tela cheia, **sem o logo por cima**, **sem o parágrafo do
 * hero** e **sem CTA imediato** — só a arte e a frase, compostas.
 *
 * ── A divisão de trabalho, que é o desenho inteiro ──────────────────────────
 *
 * | Arquivo | Sabe sobre |
 * | --- | --- |
 * | `lib/atosDaLanding.js` | **quando** cada coisa acontece — só números |
 * | `PalcoDeRolagem.jsx` | **como** prender a cena e medir o progresso |
 * | este arquivo | **o que** aparece em cada ato |
 * | `Hero`, `ConvergenciaDoHub`, `MarcaFlutuante` | continuam sendo o que eram |
 *
 * Foi a regra 19 dele: *"separe a lógica de storytelling da lógica de conteúdo
 * das cenas"*. Na prática significa que mudar o ritmo não abre este arquivo, e
 * mudar o que se vê não abre o palco.
 *
 * ── O que se perdeu, dito antes de alguém notar ─────────────────────────────
 *
 * Até 11/09 a marca pintada na abertura **assentava** no hero: mesmo centro,
 * mesma coisa, e a troca lia como continuidade. Com o ATO 0 sendo a arte sem
 * logo, essa continuidade acaba — o clarão abre para a arte, e a marca só
 * volta no quarto ato.
 *
 * Não é descuido: é o preço de o arco terminar em MARCA, que foi o pedido. E
 * há um ganho junto — a marca deixa de estar sempre ali e passa a ser **aonde
 * a história chega**. O centro combinado em `lib/marcaNoHero.js` continua valendo;
 * ele só é usado mais tarde.
 *
 * ── Sem desfoque, e a decisão é de custo ────────────────────────────────────
 *
 * A dissolução da arte seria mais bonita com `filter: blur()`. Ela é repintada
 * a cada quadro numa imagem que ocupa a tela inteira — é o travamento clássico
 * de celular, e este projeto já pagou 29.441 ms de thread principal por
 * decoração que desenhava sem parar (§0.3). Escala, opacidade e véu resolvem no
 * compositor, de graça.
 */
export default function PrologoDaLanding({ introDone = true }) {
  // `useReducedMotion` é do próprio Framer Motion — nada de segundo detector de
  // `prefers-reduced-motion` para divergir do que o CSS já usa (§4).
  const menosMovimento = useReducedMotion();

  // A troca acontece na FRONTEIRA do componente, e não dentro dele: os hooks de
  // rolagem vivem no `PalcoDeRolagem`, que simplesmente não é montado aqui.
  // Hook atrás de condicional seria quebra das Rules of Hooks.
  if (menosMovimento) return <PrologoParado introDone={introDone} />;

  return (
    <PalcoDeRolagem altura={ALTURA_DO_PROLOGO}>
      {(progresso) => <Camadas progresso={progresso} introDone={introDone} />}
    </PalcoDeRolagem>
  );
}

/**
 * As camadas, de trás para a frente. Cada uma lê a sua janela e nada mais —
 * nenhuma delas sabe que existe rolagem.
 */
function Camadas({ progresso, introDone }) {
  const { arteEntra, fraseSai, arteRecua, veuFecha, convergencia, marca, hero } = JANELAS;

  // ── ATO 0 → TRANSFORMAÇÃO: a arte avança e se desfaz ──────────────────────
  // Quatro pontos num `useTransform` só: ela cresce de volta ao natural no
  // começo (o empurrão lento que dá vida a uma imagem parada), fica, e depois
  // avança para além da tela enquanto some.
  const escalaDaArte = useTransform(
    progresso,
    [arteEntra[0], arteEntra[1], arteRecua[0], arteRecua[1]],
    [1.08, 1, 1, 1.18],
  );
  const opacidadeDaArte = useTransform(progresso, [arteRecua[0] + 0.06, arteRecua[1]], [1, 0]);
  const escurecimento = useTransform(progresso, veuFecha, [0, 0.96]);

  // ── A frase: entra por tempo, sai por rolagem (ver `atosDaLanding.js`) ────
  const opacidadeDaFrase = useTransform(progresso, fraseSai, [1, 0]);
  const alturaDaFrase = useTransform(progresso, fraseSai, [0, -56]);

  // ── CONVERGÊNCIA: os trajetos chegam de fora ──────────────────────────────
  // A contração de 1,14 para 1 é o que faz os trajetos parecerem VIR de fora da
  // tela em vez de aparecerem já no lugar.
  const opacidadeDaConvergencia = useTransform(progresso, convergencia, [0, 1]);
  const escalaDaConvergencia = useTransform(progresso, convergencia, [1.14, 1]);

  // ── MARCA: acende e assenta ───────────────────────────────────────────────
  // Três pontos: nasce, ACENDE acima do valor final, e baixa até o 0,16 do
  // contrato do hero. O pico é o impacto que o dono pediu — e ele é opacidade,
  // não clarão de tela cheia, que foi o que ele descartou em 11/09.
  const meioDaMarca = marca[0] + (marca[1] - marca[0]) * 0.55;
  const opacidadeDaMarca = useTransform(
    progresso, [marca[0], meioDaMarca, marca[1]], [0, 0.5, OPACIDADE_NO_HERO],
  );
  const escalaDaMarca = useTransform(progresso, [marca[0], marca[1]], [0.55, 1]);

  // ── GAMERHUB: o hero de sempre assume ─────────────────────────────────────
  const opacidadeDoHero = useTransform(progresso, hero, [0, 1]);
  const alturaDoHero = useTransform(progresso, hero, [40, 0]);
  // Enquanto o hero está transparente ele tem DOIS links dentro. Sem isto eles
  // continuariam clicáveis e alcançáveis por Tab — um botão invisível que leva
  // ao login é a definição de armadilha.
  const cliqueDoHero = useTransform(progresso, (v) => (v > hero[0] + 0.06 ? 'auto' : 'none'));

  // A seta só existe enquanto ninguém rolou: ela é convite, e convite que fica
  // depois de aceito vira ruído.
  const opacidadeDaSeta = useTransform(progresso, [0, 0.05], [1, 0]);

  return (
    <>
      {/* ── ARTE ────────────────────────────────────────────────────────────
          `prioridade`: esta é a primeira tela, e a arte É o conteúdo dela. É a
          única arte da landing que pode ser ansiosa — a conta está em
          `docs/DESEMPENHO.md`. */}
      <motion.div className="absolute inset-0" style={{ scale: escalaDaArte, opacity: opacidadeDaArte }}>
        <ArteDaCena arte={CENAS.hero} prioridade />
      </motion.div>

      {/* Véu fixo: a frase precisa ser legível sobre uma arte clara no miolo.
          Ele escurece o pé e o topo e deixa o meio limpo, que é onde a arte é
          o assunto. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(0deg, rgba(6,6,8,0.94) 0%, rgba(6,6,8,0.70) 22%, rgba(6,6,8,0.12) 52%, rgba(6,6,8,0.55) 100%)',
        }}
      />

      {/* Véu que FECHA: é ele que leva a cena ao preto para a convergência
          nascer do escuro. Separado do de cima porque um é composição e o outro
          é tempo. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-dark-900"
        style={{ opacity: escurecimento }}
      />

      {/* ── CONVERGÊNCIA ────────────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0"
        style={{ opacity: opacidadeDaConvergencia, scale: escalaDaConvergencia }}
      >
        <ConvergenciaDoHub className="absolute inset-0" />
      </motion.div>

      {/* ── MARCA ───────────────────────────────────────────────────────────
          `opacidade={1}`: quem controla o brilho é a camada de fora, senão o
          valor apareceria em dois lugares e o pico nunca passaria de 0,16. */}
      <motion.div
        className="absolute inset-0"
        style={{ opacity: opacidadeDaMarca, scale: escalaDaMarca }}
      >
        <MarcaFlutuante opacidade={1} />
      </motion.div>

      {/* ── A FRASE DO ATO 0 ────────────────────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 flex items-end justify-center px-6 pb-24 md:pb-28"
        style={{ opacity: opacidadeDaFrase, y: alturaDaFrase }}
      >
        <motion.h1
          variants={heroFade(0.15)}
          initial="initial"
          animate={introDone ? 'animate' : 'initial'}
          className="font-display font-bold text-white text-center leading-[1.1]
                     text-[1.75rem] sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl
                     [text-shadow:0_2px_24px_rgba(6,6,8,0.85)]"
        >
          {FRASE_DO_ATO_ZERO}
        </motion.h1>
      </motion.div>

      {/* ── GAMERHUB ─────────────────────────────────────────────────────────
          O mesmo conteúdo do hero de sempre, no mesmo lugar. Não há segunda
          versão do texto de entrada em lugar nenhum (§4). */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
        style={{ opacity: opacidadeDoHero, y: alturaDoHero, pointerEvents: cliqueDoHero }}
      >
        <ConteudoDoHero introDone={introDone} />
      </motion.div>

      <motion.div
        aria-hidden
        style={{ opacity: opacidadeDaSeta }}
        className="absolute bottom-8 inset-x-0 flex justify-center text-gray-500"
      >
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={22} />
        </motion.span>
      </motion.div>
    </>
  );
}
