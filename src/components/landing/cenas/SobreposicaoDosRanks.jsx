import { motion, useTransform } from 'framer-motion';
import PainelDaCena from './PainelDaCena';
import { getRankFromXP, getRankLabel } from '../../../lib/ranks';

/**
 * RANKS & XP — a personalidade é **PROGRESSÃO**.
 *
 * ── O que ela mostra, e por que é VERDADE ───────────────────────────────────
 *
 * A barra atravessa uma fronteira de rank de verdade: de **860 XP** para
 * **1120 XP**, cruzando os 1000 que separam Guerreiro de Elite no
 * `lib/ranks.js`. Os rótulos, as cores e os ícones dos dois lados **não estão
 * escritos aqui** — eles vêm de `getRankFromXP`, que é a mesma função que o
 * perfil de qualquer pessoa usa.
 *
 * Isso não é preciosismo: a alternativa era escrever "Guerreiro" e "Elite" à
 * mão nesta cena. No dia em que os limites mudassem, a landing passaria a
 * prometer um sistema que não existe mais — e nada acusaria, porque a página
 * continuaria bonita (§1.4).
 *
 * ── Por que a rolagem conduz, mas a cena NÃO prende ─────────────────────────
 *
 * Porque a rolagem **já é** a barra. Atravessar a seção e ver o XP subir junto
 * é a metáfora inteira; prender a cena para animar a barra sozinha seria
 * substituir o gesto da pessoa por um vídeo.
 *
 * ── O "level up" é um CORTE, e é de propósito ───────────────────────────────
 *
 * A barra vai a 100% e volta quase a zero em 1% do progresso. Interpolar essa
 * volta seria a barra ESVAZIANDO — que lê como perder XP. Progressão que
 * reinicia num quadro é o que todo jogo faz, e é o que se reconhece.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * Zero re-render do React, inclusive no número: o texto do XP é um
 * `MotionValue` renderizado como filho, e o Framer Motion escreve direto no nó
 * de texto. Contar com `useState` aqui seria uma atualização de React por
 * quadro de rolagem — o erro que custou 714 ms no `FluxoDeDados`.
 */

/** Os dois lados da fronteira. Os rótulos vêm do sistema, não daqui. */
const XP_INICIAL = 860;
const XP_FINAL = 1120;
const VIRADA = 0.625;

const ENCHE = [0.22, VIRADA];
const DEPOIS = [VIRADA + 0.01, 0.82];

export default function SobreposicaoDosRanks({ progresso, lado = 'esquerda' }) {
  const antes = getRankFromXP(XP_INICIAL);
  const depois = getRankFromXP(XP_FINAL);
  const IconeAntes = antes.icon;
  const IconeDepois = depois.icon;

  const xp = useTransform(progresso, [ENCHE[0], DEPOIS[1]], [XP_INICIAL, XP_FINAL]);
  const xpTexto = useTransform(xp, (v) => Math.round(v).toLocaleString('pt-BR'));

  // Quatro pontos: enche até o fim, VIRA num piscar, e recomeça a subir.
  const enchimento = useTransform(
    progresso,
    [ENCHE[0], ENCHE[1], DEPOIS[0], DEPOIS[1]],
    [0.14, 1, 0.03, 0.24],
  );

  // Duas barras empilhadas em vez de uma mudando de cor: interpolar cor não é
  // composto pelo navegador, e a troca precisa ser seca de qualquer forma.
  const corAntes = useTransform(progresso, [ENCHE[1], DEPOIS[0]], [1, 0]);
  const corDepois = useTransform(progresso, [ENCHE[1], DEPOIS[0]], [0, 1]);
  const escalaDoSelo = useTransform(
    progresso, [ENCHE[1] - 0.02, DEPOIS[0] + 0.05, DEPOIS[0] + 0.12], [1, 1.22, 1],
  );

  return (
    <PainelDaCena lado={lado} largura="w-[15rem]">
      <div className="flex items-center justify-between pb-2.5">
        {/* Os dois selos ocupam a MESMA célula, empilhados: o novo não empurra
            nada ao chegar, ele toma o lugar do antigo. */}
        <motion.span className="relative inline-flex items-center gap-1.5" style={{ scale: escalaDoSelo }}>
          <motion.span className="inline-flex items-center gap-1.5" style={{ opacity: corAntes }}>
            <IconeAntes size={14} style={{ color: antes.color }} />
            <span className="font-mono text-[0.68rem]" style={{ color: antes.color }}>
              {getRankLabel(antes)}
            </span>
          </motion.span>
          <motion.span
            className="absolute left-0 top-0 inline-flex items-center gap-1.5 whitespace-nowrap"
            style={{ opacity: corDepois }}
          >
            <IconeDepois size={14} style={{ color: depois.color }} />
            <span className="font-mono text-[0.68rem]" style={{ color: depois.color }}>
              {getRankLabel(depois)}
            </span>
          </motion.span>
        </motion.span>

        <span className="font-mono text-[0.66rem] text-gray-400">
          <motion.span className="text-white">{xpTexto}</motion.span> XP
        </span>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="absolute inset-0 origin-left rounded-full"
          style={{ scaleX: enchimento, opacity: corAntes, background: antes.color }}
        />
        <motion.div
          className="absolute inset-0 origin-left rounded-full"
          style={{ scaleX: enchimento, opacity: corDepois, background: depois.color }}
        />
      </div>

      <p className="pt-2 font-body text-[0.66rem] leading-snug text-gray-400">
        Postar rende <span className="text-neon-green">20 XP</span>. Comentar,
        3. Receber curtida, 5.
      </p>
    </PainelDaCena>
  );
}
