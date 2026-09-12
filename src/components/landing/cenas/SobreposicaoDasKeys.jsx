import { motion, useTransform } from 'framer-motion';
import { KeyRound, Copy } from 'lucide-react';
import PainelDaCena from './PainelDaCena';

/**
 * KEYS & PROMOS — a personalidade é **DESCOBERTA**.
 *
 * ── A primeira versão estava errada, e o print mostrou ──────────────────────
 *
 * Eu tinha desenhado uma fileira de cinco cartas de jogo desfilando. No
 * navegador ficou óbvio o problema: **a arte desta cena JÁ É a coleção** — ela
 * tem uma parede de capas reais. Minhas cartas de gradiente ao lado delas
 * pareciam exatamente o que eram, um remendo, e ainda disputavam atenção com o
 * assunto do quadro.
 *
 * Cortei. É a regra 20 do prompt dele em ação: *"se perceber que determinada
 * animação está ficando exagerada: corte"*.
 *
 * ── O que ficou no lugar, e por que é melhor ────────────────────────────────
 *
 * A arte é a coleção; a sobreposição é **o que você encontrou dentro dela**.
 * Uma key só, com a plataforma, o código coberto, e o preço se abrindo.
 *
 * `muitas possibilidades (a arte) → uma é sua (a carta) → o código aparece →
 * a oportunidade se revela`.
 *
 * ── O código nasce COBERTO, e isso é o produto ──────────────────────────────
 *
 * Key não se mostra antes de ser resgatada — é assim no site e é assim em
 * qualquer lugar que distribua chave. Então a tarja que desliza não é efeito:
 * é a interação real da funcionalidade, e é o instante exato da descoberta.
 *
 * ── O reflexo é o MESMO da marca ────────────────────────────────────────────
 *
 * A faixa de luz que atravessa a carta no fim é o desenho do polimento da
 * abertura e do brilho da `MarcaFlutuante`: transparente, clara no meio,
 * transparente, correndo torto. Repetir o gesto é o que faz a landing parecer
 * um produto só, e não uma coleção de efeitos.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * Tudo é `transform` e `opacity` conduzidos por `MotionValue`: sem `useState`,
 * sem laço por quadro, sem filtro. A tarja é um retângulo deslizando.
 */

const CHEGA = [0.08, 0.30];
const DESCOBRE = [0.34, 0.58];
const PRECO = [0.56, 0.76];
const REFLEXO = [0.74, 0.96];

export default function SobreposicaoDasKeys({ progresso, lado = 'esquerda' }) {
  const escala = useTransform(progresso, CHEGA, [0.86, 1]);
  const opacidade = useTransform(progresso, CHEGA, [0, 1]);
  const subida = useTransform(progresso, CHEGA, [26, 0]);

  // A tarja sai para a DIREITA, no sentido da leitura: o código aparece da
  // primeira letra para a última, como se estivesse sendo lido.
  const tarja = useTransform(progresso, DESCOBRE, ['0%', '104%']);

  const risco = useTransform(progresso, [PRECO[0], PRECO[1] - 0.06], [0, 1]);
  const gratis = useTransform(progresso, [PRECO[0] + 0.06, PRECO[1]], [0, 1]);
  const escalaDoGratis = useTransform(
    progresso, [PRECO[0] + 0.06, PRECO[1] - 0.04, PRECO[1]], [0.6, 1.12, 1],
  );
  const reflexo = useTransform(progresso, REFLEXO, ['-140%', '260%']);

  return (
    <PainelDaCena lado={lado} vidro={false} ancora="topo" largura="w-[min(86vw,18.5rem)]">
      <motion.div
        className="relative overflow-hidden rounded-xl border border-neon-green/25
                   bg-dark-900/85 backdrop-blur-sm p-3.5
                   shadow-[0_10px_36px_rgba(0,0,0,0.6)]"
        style={{ scale: escala, opacity: opacidade, y: subida }}
      >
        <div className="flex items-center justify-between pb-2.5">
          <span className="flex items-center gap-1.5 font-mono text-[0.6rem] tracking-[0.2em] text-gray-400">
            <KeyRound size={12} className="text-neon-green" />
            STEAM
          </span>
          <span className="font-mono text-[0.58rem] tracking-[0.16em] text-gray-500">
            1 DE 3 RESTANTES
          </span>
        </div>

        {/* O código e a tarja que o cobre. A tarja é IRMÃ do código, no mesmo
            contêiner recortado — assim ela desliza para fora sem que nada
            precise mudar de tamanho. */}
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/45 py-2">
          <p className="text-center font-mono text-[0.82rem] tracking-[0.18em] text-white">
            X4K7-9QW2-MB3D
          </p>
          {/* A tarja tem uma BORDA acesa na frente. Sem ela o retângulo é quase
              da cor do cartão e o deslize não se vê — a pessoa perceberia o
              código já revelado, e o instante da descoberta, que é o assunto da
              cena, passaria despercebido. Achado no print. */}
          <motion.div
            className="absolute inset-0 border-r-2 border-neon-green/70
                       bg-gradient-to-r from-dark-800 to-dark-600"
            style={{ x: tarja }}
          >
            <span className="flex h-full items-center justify-center font-mono
                             text-[0.58rem] tracking-[0.22em] text-gray-400">
              RESGATAR PARA VER
            </span>
          </motion.div>
        </div>

        <div className="flex items-center justify-between pt-2.5">
          <span className="flex items-center gap-2.5">
            <span className="relative font-mono text-[0.7rem] text-gray-500">
              R$ 129,90
              {/* O risco é DESENHADO passando, não um `line-through` que já
                  nasce pronto: é o preço sendo cancelado na sua frente. */}
              <motion.span
                className="absolute left-0 top-1/2 h-px w-full origin-left bg-gray-500"
                style={{ scaleX: risco }}
              />
            </span>
            <motion.span
              className="rounded-md border border-neon-green/40 bg-neon-green/10 px-2 py-0.5
                         font-mono text-[0.68rem] tracking-[0.16em] text-neon-green"
              style={{ opacity: gratis, scale: escalaDoGratis }}
            >
              GRÁTIS
            </motion.span>
          </span>
          <Copy size={12} className="text-gray-600" />
        </div>

        <motion.div
          className="pointer-events-none absolute inset-y-[-40%] left-0 w-14 -rotate-[16deg]"
          style={{
            x: reflexo,
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
          }}
        />
      </motion.div>
    </PainelDaCena>
  );
}
