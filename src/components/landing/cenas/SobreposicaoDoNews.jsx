import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, Link2 } from 'lucide-react';
import PainelDaCena from './PainelDaCena';

/**
 * NEWS — a personalidade é **APURAÇÃO**: *"isto foi checado antes de sair"*.
 *
 * ── Por que esta cena existia sem sobreposição, e por que isso era um buraco ─
 *
 * `[25/09]` O News entrou na landing com a arte e o texto, e sem camada viva —
 * a única das cenas assim. Ficava meia tela de ambiente vazia ao lado do
 * título, e a seção lia como anúncio de algo que ainda não existe. O que ela
 * precisava não era enfeite: era **mostrar a promessa que o texto faz**.
 *
 * O texto promete *"garimpa, checa e escreve. Sem caça-clique e sem repost sem
 * fonte"*. Então é isso que a camada encena, nessa ordem:
 *
 *   TRÊS FONTES  ->  a matéria com as fontes presas  ->  REVISÃO  ->  NO AR
 *
 * ── Por que as fontes aparecem ANTES da matéria ─────────────────────────────
 *
 * Porque é a ordem real, e é o argumento inteiro do GamerHub News. Um agregador
 * mostraria a manchete e o link embaixo; aqui a manchete **nasce** das fontes,
 * que é a diferença entre apurar e repostar. Inverter a ordem na animação
 * contaria a história do concorrente.
 *
 * ── Por que por TEMPO, e não por rolagem ────────────────────────────────────
 *
 * Mesma razão do feed: quem rola para trás não "desapura" uma matéria. A
 * rolagem serve a transformação reversível (ver `CenaPresa`); esta é uma
 * sequência que acontece uma vez e fica.
 *
 * ── O custo ─────────────────────────────────────────────────────────────────
 *
 * Quatro `setTimeout`, agendados de uma vez quando a cena entra na tela e
 * limpos no cleanup. Nenhum laço por quadro, nenhum estado durante a rolagem —
 * a diferença entre isto e uma animação quadro a quadro foi medida em 714 ms
 * no `FluxoDeDados` (`docs/DESEMPENHO.md`).
 *
 * Quem pediu menos movimento vê o **fim** da história, não uma tela vazia.
 */

/**
 * As fontes. Elas são genéricas de propósito: pôr o nome de veículo real na
 * landing seria usar marca de terceiro como endosso, e a lista de fontes do
 * radar muda sem a landing saber (`docs/OPERACAO.md`).
 */
const FONTES = [
  { rotulo: 'fonte.br',  cor: 'text-neon-green'  },
  { rotulo: 'fonte.com', cor: 'text-neon-cyan'   },
  { rotulo: 'fonte.gg',  cor: 'text-neon-purple' },
];

/** Os estados pelos quais a matéria passa, e a cor de cada um na tela. */
const ESTADOS = [
  { rotulo: 'rascunho', cor: 'text-gray-500 border-gray-600' },
  { rotulo: 'revisão',  cor: 'text-yellow-400 border-yellow-400/50' },
  { rotulo: 'no ar',    cor: 'text-neon-green border-neon-green/60' },
];

/** As batidas, em milissegundos, depois de a cena entrar na tela. */
const BATIDAS = [700, 1500, 2400, 3300];

export default function SobreposicaoDoNews({ lado = 'direita' }) {
  const menosMovimento = useReducedMotion();
  const caixa = useRef(null);
  const naTela = useInView(caixa, { once: true, amount: 0.4 });

  // `passo` anda de 0 a 4 e é o único estado. Não é relógio: são quatro
  // `setTimeout` agendados juntos.
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (!naTela || menosMovimento) return undefined;
    const relogios = BATIDAS.map((ms, i) => setTimeout(() => setPasso(i + 1), ms));
    return () => relogios.forEach(clearTimeout);
  }, [naTela, menosMovimento]);

  const estado = menosMovimento ? 4 : passo;
  const mostrar = menosMovimento || naTela;
  // 0–1 rascunho · 2 revisão · 3+ no ar. O índice é derivado, não guardado:
  // dois estados para a mesma coisa é onde eles divergem.
  const fase = ESTADOS[Math.min(Math.max(estado - 1, 0), 2)];

  return (
    <PainelDaCena lado={lado}>
      <div ref={caixa} className="space-y-3">
        {/* 1. As fontes chegam primeiro — é delas que sai a matéria. */}
        <div className="flex flex-wrap gap-1.5">
          {FONTES.map((f, i) => (
            <motion.span
              key={f.rotulo}
              className="flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-1 font-mono text-[0.58rem] leading-none"
              initial={menosMovimento ? false : { opacity: 0, y: -8 }}
              animate={mostrar ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.4, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link2 size={9} className={f.cor} />
              <span className="text-gray-400">{f.rotulo}</span>
            </motion.span>
          ))}
        </div>

        {/* 2. A matéria. As barras são abstratas porque manchete inventada na
            landing é promessa de conteúdo que não existe — e envelheceria. */}
        <motion.div
          className="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-2.5"
          initial={menosMovimento ? false : { opacity: 0, y: 12 }}
          animate={estado >= 1 ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={menosMovimento || estado >= 1 ? undefined : { opacity: 0 }}
        >
          <div className="h-2 w-11/12 rounded-full bg-white/25" />
          <div className="h-1.5 w-3/4 rounded-full bg-white/15" />
          <div className="space-y-1 pt-0.5">
            <div className="h-1 w-full rounded-full bg-white/10" />
            <div className="h-1 w-5/6 rounded-full bg-white/10" />
          </div>

          {/* 3. O carimbo de conferido. Ele ACENDE num lugar que já existia —
              como a marca de "checado" que só aparece depois de checar. */}
          <div className="flex items-center gap-1.5 pt-1">
            <motion.span
              animate={estado >= 2 ? { scale: [1, 1.3, 1] } : undefined}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border
                ${estado >= 2 ? 'border-neon-green/70 bg-neon-green/15' : 'border-gray-700'}`}
            >
              <Check size={8} className={estado >= 2 ? 'text-neon-green' : 'text-gray-700'} />
            </motion.span>
            <span className={`font-mono text-[0.55rem] leading-none
              ${estado >= 2 ? 'text-neon-green' : 'text-gray-600'}`}>
              {estado >= 2 ? '3 fontes conferidas' : 'conferindo…'}
            </span>
          </div>
        </motion.div>

        {/* 4. O corte editorial: quem escreve não é quem publica. É a regra que
            o banco impõe (`INV-EDIT-001`), encenada em três palavras. */}
        <div className="flex items-center gap-1.5">
          {ESTADOS.map((e, i) => (
            <span
              key={e.rotulo}
              className={`rounded border px-1.5 py-0.5 font-mono text-[0.52rem] uppercase leading-none
                transition-colors duration-500
                ${e.rotulo === fase.rotulo && estado >= 1
                  ? e.cor
                  : 'border-white/5 text-gray-700'}`}
            >
              {e.rotulo}
              {i < ESTADOS.length - 1 && ''}
            </span>
          ))}
        </div>
      </div>
    </PainelDaCena>
  );
}
