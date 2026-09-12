import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Heart, MessageCircle } from 'lucide-react';
import PainelDaCena from './PainelDaCena';

/**
 * FEED — a personalidade é **ATIVIDADE**: *"existe gente usando isso agora"*.
 *
 * ── Por que o movimento é por TEMPO, e não por rolagem ──────────────────────
 *
 * Esta é a decisão que define a cena. As outras respondem à rolagem porque
 * contam uma transformação; o feed não tem transformação nenhuma — ele tem um
 * **estado**, e o estado é "coisas continuam chegando".
 *
 * Amarrar isso à barra de rolagem inverteria o significado: a atividade
 * pararia quando a pessoa parasse de rolar, e o feed passaria a dizer
 * *"isto acontece quando você mexe"*, que é o oposto de uma comunidade viva.
 *
 * ── O que acontece, em ordem ────────────────────────────────────────────────
 *
 * Três publicações chegam escalonadas (a de cima primeiro, como num feed que
 * recebe), a curtida acende, o contador sobe **duas vezes** — uma só leria
 * como animação de entrada; duas leem como outra pessoa curtindo — e por fim
 * um comentário desliza.
 *
 * ── O custo, e por que ele é honesto ────────────────────────────────────────
 *
 * O contador muda **três vezes no total**, com `setTimeout`. Não há laço por
 * quadro e não há `useState` durante a rolagem — a diferença entre isto e um
 * contador animado quadro a quadro é a mesma que custou 714 ms no `FluxoDeDados`
 * (ver `docs/DESEMPENHO.md`).
 *
 * E a corrente só dispara quando a cena **entra na tela**: quem nunca rolou até
 * aqui não paga temporizador nenhum.
 */

/**
 * As publicações. Elas têm NOME, e isso é conserto de um erro meu: na primeira
 * versão cada linha era só duas barras cinzas, e o print revelou o problema —
 * lia como **tela de carregamento**, não como feed. Um apelido e um horário
 * bastam para o olho entender que ali tem gente, e continuam abstratos o
 * bastante para não competir com os posts que a própria arte desenha.
 */
/**
 * `[12/09]` As duas últimas são `soNoPc`, a pedido dele: *"ficou pequeno demais
 * os elementos pra uma tela grande, tem como colocar mais elementos?"*.
 *
 * O feed é a única das cinco sobreposições que é uma **lista** — nas outras,
 * "mais elementos" seria inventar conteúdo. Aqui é o oposto: três linhas num
 * painel que cresceu 55% deixam sobra embaixo, e um feed com três posts contando
 * que "não para" é a própria contradição.
 *
 * No celular elas ficam de fora porque lá o painel já ocupa 63% da largura e
 * mora sobre uma arte em pé, com menos espaço livre — a mesma razão do
 * `soCompleto` dos sinais do ATO 0.
 */
const PUBLICACOES = [
  { cor: 'from-neon-green to-cyan-400', nome: '@kaue', quando: 'agora', barra: 'w-full' },
  { cor: 'from-cyan-400 to-neon-purple', nome: '@nina_', quando: '2 min', barra: 'w-4/5' },
  { cor: 'from-neon-purple to-orange-400', nome: '@th1ago', quando: '5 min', barra: 'w-5/6' },
  { cor: 'from-orange-400 to-red-400', nome: '@duh', quando: '8 min', barra: 'w-3/4', soNoPc: true },
  { cor: 'from-cyan-400 to-neon-green', nome: '@lipe.rx', quando: '12 min', barra: 'w-11/12', soNoPc: true },
];

/** As três batidas depois de as publicações assentarem, em milissegundos. */
const BATIDAS = [900, 1900, 2900];

export default function SobreposicaoDoFeed({ lado = 'esquerda' }) {
  const menosMovimento = useReducedMotion();
  const caixa = useRef(null);
  const naTela = useInView(caixa, { once: true, amount: 0.4 });

  // `passo` é o único estado, e ele anda de 0 a 3. Não é um relógio: são três
  // `setTimeout` agendados de uma vez e limpos no cleanup.
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (!naTela || menosMovimento) return undefined;
    const relogios = BATIDAS.map((ms, i) => setTimeout(() => setPasso(i + 1), ms));
    return () => relogios.forEach(clearTimeout);
  }, [naTela, menosMovimento]);

  // Quem pediu menos movimento vê o FIM da história, não uma tela vazia: o
  // conteúdo é o mesmo, sem o tempo.
  const estado = menosMovimento ? 3 : passo;
  const curtidas = 128 + Math.min(estado, 2);
  const mostrar = menosMovimento || naTela;

  return (
    <PainelDaCena lado={lado}>
      <div ref={caixa} className="space-y-2.5">
        {PUBLICACOES.map((post, i) => (
          <motion.div
            key={i}
            className={`items-center gap-2.5 ${post.soNoPc ? 'hidden md:flex' : 'flex'}`}
            initial={menosMovimento ? false : { opacity: 0, y: 14 }}
            animate={mostrar ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5, delay: i * 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={`h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br ${post.cor} opacity-90`} />
            <div className="flex-1 space-y-1.5">
              <p className="font-mono text-[0.6rem] leading-none text-gray-300">
                {post.nome}
                <span className="text-gray-600"> · {post.quando}</span>
              </p>
              <div className={`h-1.5 rounded-full bg-white/20 ${post.barra}`} />
            </div>
          </motion.div>
        ))}

        <div className="h-px bg-white/10" />

        <div className="flex items-center gap-4 font-mono text-[0.68rem] text-gray-400">
          <span className="flex items-center gap-1.5">
            {/* O coração ACENDE em vez de aparecer: ele já estava ali, apagado,
                como está num post que ninguém curtiu ainda. */}
            <motion.span
              animate={estado >= 1 ? { scale: [1, 1.35, 1] } : undefined}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="inline-flex"
            >
              <Heart
                size={13}
                className={estado >= 1 ? 'text-neon-green' : 'text-gray-600'}
                fill={estado >= 1 ? 'currentColor' : 'none'}
              />
            </motion.span>
            <motion.span key={curtidas} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
              {curtidas}
            </motion.span>
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={13} className="text-gray-600" />
            {estado >= 3 ? 25 : 24}
          </span>
        </div>

        {/* O comentário é o último a chegar, e é o que fecha a leitura: primeiro
            alguém curtiu, depois alguém respondeu. */}
        <motion.div
          className="rounded-lg bg-white/[0.06] px-2.5 py-1.5"
          initial={menosMovimento ? false : { opacity: 0, x: -10 }}
          animate={estado >= 3 ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={menosMovimento || estado >= 3 ? undefined : { opacity: 0 }}
        >
          <p className="font-body text-[0.7rem] leading-snug text-gray-300">
            <span className="text-neon-green">@lua</span> que jogo insano, joguei
            a noite toda
          </p>
        </motion.div>
      </div>
    </PainelDaCena>
  );
}
