import { useRef } from 'react';
import { motion, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { SECOES, alvoDaSecao } from './secoesDaLanding';
import useProgressoDeRolagem from '../../hooks/useProgressoDeRolagem';

/**
 * A faixa de destaques do topo — o índice da página, e a PONTE entre o prólogo
 * e a primeira cena.
 *
 * ── Por que virou link ──────────────────────────────────────────────────────
 *
 * Pedido do dono: *"queria adicionar links nesses cards que falam do site, pra
 * pessoa poder clicar e ir direto aonde explica, pq imagina o site cresce, e o
 * usuário ter que rolar uma tela grande"*.
 *
 * Ele está certo e o problema piora sozinho: cada seção nova alonga a página, e
 * um card que só descreve vira uma promessa sem caminho. **Isto não muda**: os
 * cards continuam clicáveis e continuam levando às âncoras.
 *
 * ── `[12/09]` O que mudou: eles deixaram de ser uma SEÇÃO ───────────────────
 *
 * Diagnóstico do dono no quarto prompt: *"o hero termina e depois temos o
 * HighlightsStrip... os cards parecem de uma nova página"*. Ele estava certo, e
 * a causa era o `whileInView`: os cards apareciam de uma vez, já depois de o
 * hero ter saído, num fundo vazio. Duas coisas separadas, uma após a outra.
 *
 * Agora eles são conduzidos pela **rolagem**, e sobem enquanto o hero ainda
 * está preso na tela — a `Landing` os faz invadir os últimos 12vh do prólogo.
 * A leitura passa a ser *"o hero cede e os cards assumem"* em vez de
 * *"acabou uma coisa, começou outra"*.
 *
 * ── E eles SAEM, o que é a outra metade da ponte ────────────────────────────
 *
 * Ao chegar ao fim da travessia os cards sobem e perdem peso, e a arte do feed
 * entra por baixo deles. Sem essa saída, o corte só se mudava de lugar: em vez
 * de "hero → cards" ele viraria "cards → feed".
 *
 * **Eles não somem.** A opacidade mínima é 0,25 e nunca zero — card invisível e
 * clicável é armadilha, e é justamente a regra que o `PrologoDaLanding` já
 * aplica ao hero.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * Cinco cartas, cada uma com dois `MotionValue`. Nenhum `useState`, nenhum laço
 * por quadro: o Framer Motion escreve o `transform` direto no elemento.
 *
 * ── A lista some daqui de propósito ─────────────────────────────────────────
 *
 * Ela mora em `secoesDaLanding.js`, junto com a do rodapé e a da navegação
 * lateral. A versão anterior tinha a lista escrita à mão aqui, e ela já
 * divergia da página: citava "Lives ao vivo" e **não mencionava Keys**, que é
 * uma seção inteira do site (§4, fonte única).
 */

/** Quando cada carta sobe e quando ela cede, no progresso da travessia. */
const ENTRA = [0.10, 0.46];
const SAI = [0.62, 0.92];

function CartaDeDestaque({ progresso, secao, indice, parado }) {
  const { id, rotulo, icone: Icone, cor } = secao;
  // O atraso por índice é o que faz a faixa se montar da esquerda para a
  // direita, em vez de as cinco pousarem no mesmo instante.
  const atraso = indice * 0.045;
  const subida = useTransform(
    progresso,
    [ENTRA[0] + atraso, ENTRA[1] + atraso, SAI[0], SAI[1]],
    [44, 0, 0, -34],
  );
  const opacidade = useTransform(
    progresso,
    [ENTRA[0] + atraso, ENTRA[1] + atraso, SAI[0], SAI[1]],
    [0, 1, 1, 0.25],
  );

  return (
    <motion.a
      href={alvoDaSecao(id)}
      style={parado ? undefined : { y: subida, opacity: opacidade }}
      whileHover={{ y: -3 }}
      className="card p-4 flex flex-col items-center gap-2 text-center group focus:outline-none focus:ring-1 focus:ring-neon-green/60"
    >
      <Icone size={22} className={cor} />
      <span className="text-xs font-mono text-gray-400 group-hover:text-gray-200 transition-colors">
        {rotulo}
      </span>
      <ArrowDown
        size={12}
        aria-hidden
        className="text-gray-700 group-hover:text-neon-green transition-colors"
      />
    </motion.a>
  );
}

export default function HighlightsStrip() {
  const alvo = useRef(null);
  const progresso = useProgressoDeRolagem(alvo, 'solta');
  const parado = useReducedMotion();

  return (
    <nav
      ref={alvo}
      aria-label="Seções desta página"
      className="grid grid-cols-2 md:grid-cols-5 gap-3 py-10"
    >
      {SECOES.map((secao, i) => (
        <CartaDeDestaque
          key={secao.id} secao={secao} indice={i}
          progresso={progresso} parado={parado}
        />
      ))}
    </nav>
  );
}
