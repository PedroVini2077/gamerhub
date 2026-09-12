import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Eye } from 'lucide-react';
import PainelDaCena from './PainelDaCena';

/**
 * LIVES — a personalidade é **PRESENÇA**: *"isto não é a foto de uma live"*.
 *
 * ── A ideia que decide a cena inteira ───────────────────────────────────────
 *
 * O dono sugeriu, e ele está certo: *"deixar o player quase parado enquanto o
 * chat continua se movimentando"*. É o contraste que comunica, não o movimento.
 *
 * Uma live **é** exatamente isso do lado de fora da tela: a imagem muda devagar
 * e o chat não para. Fazer tudo pulsar diria "animação"; fazer só o chat andar
 * diz "tem gente do outro lado agora". Por isso a arte não recebe transformação
 * nenhuma aqui — a quietude dela é parte do efeito.
 *
 * ── Por que o relógio PARA quando ninguém está vendo ────────────────────────
 *
 * Este é o único lugar da landing com um temporizador que se repete. Deixá-lo
 * correndo para quem já rolou para longe é a lição de 29.441 ms de thread
 * principal que a cena 3D custou (§0.3) — em versão barata, mas a mesma.
 *
 * O `useInView` **sem `once`** é o que faz a diferença: ele liga e desliga.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * Uma troca de estado a cada 2,6 s, e só com a cena na tela. Quatro linhas de
 * texto entram e saem por `transform`/`opacity`. Não há laço por quadro.
 */

/**
 * O chat. Sem emoji — é regra do projeto na interface inteira, e vale aqui
 * também: o que precisa parecer de verdade é o ritmo das mensagens, não o
 * enfeite delas.
 */
const MENSAGENS = [
  { nome: 'kaue', cor: 'text-neon-green', texto: 'esse clutch foi absurdo' },
  { nome: 'nina_', cor: 'text-cyan-400', texto: 'entrei agora, perdi muita coisa?' },
  { nome: 'rafa', cor: 'text-purple-400', texto: 'sobe o volume do jogo pfvr' },
  { nome: 'duda', cor: 'text-orange-400', texto: 'ranked amanhã? monto squad' },
  { nome: 'th1ago', cor: 'text-neon-green', texto: 'primeira vez aqui, curti demais' },
  { nome: 'mel', cor: 'text-cyan-400', texto: 'a build nova ficou muito boa' },
  { nome: 'jv', cor: 'text-purple-400', texto: 'esse mapa é o melhor do jogo' },
];

const VISIVEIS = 4;
const RITMO_MS = 2600;

export default function SobreposicaoDasLives({ lado = 'esquerda' }) {
  const menosMovimento = useReducedMotion();
  const caixa = useRef(null);
  // SEM `once`: aqui o objetivo é justamente saber quando a cena SAIU.
  const naTela = useInView(caixa, { amount: 0.3 });
  const [inicio, setInicio] = useState(0);

  useEffect(() => {
    if (!naTela || menosMovimento) return undefined;
    const relogio = setInterval(() => setInicio((i) => i + 1), RITMO_MS);
    return () => clearInterval(relogio);
  }, [naTela, menosMovimento]);

  const janela = Array.from({ length: VISIVEIS }, (_, i) => {
    const indice = (inicio + i) % MENSAGENS.length;
    return { ...MENSAGENS[indice], chave: inicio + i };
  });

  // O contador de espectadores oscila em torno de um número, como um contador
  // real: gente entrando e saindo. Ele muda junto com o chat, e não sozinho —
  // dois relógios independentes na mesma caixa leriam como ruído.
  const assistindo = 1247 + ((inicio * 7) % 23) - 11;

  return (
    <PainelDaCena lado={lado} largura="w-[17rem]">
      <div ref={caixa}>
        <div className="flex items-center justify-between pb-2.5">
          <span className="flex items-center gap-1.5">
            {/* O ponto do AO VIVO: a única coisa que pulsa nesta cena, e ela
                pulsa devagar. Emissora nenhuma pisca o "ao vivo" rápido. */}
            <motion.span
              className="block h-1.5 w-1.5 rounded-full bg-red-500"
              animate={naTela && !menosMovimento ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="font-mono text-[0.6rem] tracking-[0.22em] text-red-400">AO VIVO</span>
          </span>
          <span className="flex items-center gap-1 font-mono text-[0.62rem] text-gray-400">
            <Eye size={11} />
            {assistindo.toLocaleString('pt-BR')}
          </span>
        </div>

        <div className="h-px bg-white/10" />

        {/* Altura FIXA: sem ela a caixa cresce e encolhe a cada mensagem, e a
            arte por baixo parece tremer. */}
        <div className="relative mt-2.5 h-[5.6rem] overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {janela.map((msg) => (
              <motion.p
                key={msg.chave}
                layout
                initial={menosMovimento ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={menosMovimento ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="mb-1 font-body text-[0.7rem] leading-snug text-gray-300"
              >
                <span className={`${msg.cor} font-mono text-[0.66rem]`}>{msg.nome}</span>
                <span className="text-gray-600"> · </span>
                {msg.texto}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </PainelDaCena>
  );
}
