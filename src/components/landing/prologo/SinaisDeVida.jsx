import { useRef } from 'react';
import { motion, useTransform, useInView } from 'framer-motion';
import { Heart, KeyRound, Users } from 'lucide-react';
import { JANELAS } from '../../../lib/atosDaLanding';

/**
 * SINAIS DE VIDA — o ATO 0 deixa de ser arte parada e vira um mundo habitado.
 *
 * ── O que o dono pediu, e o que ele NÃO pediu ───────────────────────────────
 *
 * *"A primeira cena está visualmente forte, mas está um pouco vazia porque,
 * enquanto a pessoa permanece nela antes da transformação, temos essencialmente
 * arte + frase."*
 *
 * E o limite, na mesma mensagem: *"não quero animar a imagem inteira nem
 * colocar efeitos genéricos por cima"*. A regra que ele escreveu vale palavra
 * por palavra — **ARTE + CAMADA DE PRODUTO ANIMADA**, e não **ARTE + EFEITOS
 * VISUAIS GENÉRICOS**.
 *
 * Por isso cada sinal é um **fragmento da experiência GamerHub**: uma curtida,
 * alguém digitando, gente online, uma key nova, XP caindo, uma live no ar. Nada
 * aqui é uma partícula, um brilho ou uma forma abstrata — são as mesmas seis
 * coisas que as cenas de baixo mostram por inteiro, aparecendo de relance.
 *
 * ── A função narrativa, que é o motivo de ele existir ───────────────────────
 *
 * `ARTE → sinais de atividade → os sinais se LIGAM → CONVERGÊNCIA → MARCA`.
 *
 * As linhas finas que unem alguns sinais entram tarde no ciclo de propósito.
 * Sem elas, os trajetos do `ConvergenciaDoHub` surgem do nada quando a rolagem
 * começa. Com elas, a cena já tinha dito que existe atividade **e ligação**
 * acontecendo ali — a convergência passa a ser a conclusão de algo, e não um
 * efeito novo.
 *
 * ── Onde eles podem pousar ──────────────────────────────────────────────────
 *
 * As posições evitam duas zonas: o **miolo**, onde a arte tem o próprio
 * monograma desenhado, e o **pé**, onde a frase mora. É a mesma regra do
 * `PainelDaCena` das cenas de baixo — a camada pousa onde a composição deixou
 * espaço, e nunca em cima de um detalhe do quadro.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * O ciclo inteiro é `@keyframes` de `opacity` e `transform`, no compositor (ver
 * `estilos/sinaisDeVida.css`). O único JavaScript aqui é o que já é padrão no
 * projeto: um `useInView` que **pausa** tudo quando a cena sai da tela, e uma
 * opacidade de saída conduzida pela rolagem.
 *
 * Nenhum `useState`, nenhum temporizador, nenhum laço por quadro.
 */

/**
 * Os seis sinais. `atraso` é o que espaça a aparição: o ciclo dura 16 s e cada
 * um fica visível ~3 s, então com estes valores no máximo dois convivem na
 * tela — que é o *"não quero que tudo aconteça simultaneamente"* dele.
 *
 * `soCompleto` esconde o sinal no celular. Numa tela em pé, seis fragmentos
 * sobre a arte viram poluição — e a arte de retrato tem menos espaço livre.
 */
const SINAIS = [
  {
    id: 'curtida', em: 'left-[14%] top-[26%]', atraso: '0s', cor: '#39ff14',
    icone: Heart, texto: '+1', pulso: false,
  },
  {
    id: 'digitando', em: 'left-[70%] top-[19%]', atraso: '2.6s', cor: '#00ffff',
    texto: 'alguém está digitando', pontos: true, soCompleto: true,
  },
  {
    id: 'online', em: 'left-[9%] top-[57%]', atraso: '5.2s', cor: '#39ff14',
    icone: Users, texto: '2.1 mil online', pulso: true,
  },
  {
    id: 'key', em: 'left-[76%] top-[45%]', atraso: '7.8s', cor: '#ffa33a',
    icone: KeyRound, texto: 'key liberada', soCompleto: true,
  },
  {
    // `pulso` sem ícone: no print o chip só de texto sumia contra a parte
    // escura da arte — faltava uma âncora de cor. O ponto resolve sem
    // acrescentar mais um ícone à cena.
    id: 'xp', em: 'left-[26%] top-[70%]', atraso: '10.4s', cor: '#bf00ff',
    texto: '+20 XP', pulso: true, soCompleto: true,
  },
  {
    id: 'live', em: 'left-[62%] top-[64%]', atraso: '13s', cor: '#ff4d4d',
    texto: 'ao vivo', pulso: true,
  },
];

/**
 * As ligações, em coordenadas de 0 a 100 — as MESMAS posições dos sinais acima.
 * Escritas aqui e não derivadas porque o SVG tem sistema próprio: derivar
 * exigiria medir o elemento no DOM, que é trabalho por quadro para desenhar
 * três linhas que ninguém mede.
 */
const LIGACOES = [
  { de: [16, 28], para: [50, 46], cor: '#39ff14', atraso: '0s' },
  { de: [72, 21], para: [50, 46], cor: '#00ffff', atraso: '0.9s' },
  { de: [11, 59], para: [50, 46], cor: '#bf00ff', atraso: '1.8s' },
];

function Sinal({ sinal }) {
  const { em, atraso, cor, icone: Icone, texto, pulso, pontos, soCompleto } = sinal;

  return (
    <div
      className={`sinal-de-vida absolute ${em} ${soCompleto ? 'hidden md:block' : ''}`}
      style={{ animationDelay: atraso }}
    >
      <span
        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1
                   font-mono text-[0.58rem] tracking-wide text-gray-200
                   bg-dark-900/70 backdrop-blur-[2px] whitespace-nowrap"
        style={{ borderColor: `${cor}44` }}
      >
        {Icone && <Icone size={11} style={{ color: cor }} fill={pulso ? 'none' : cor} />}
        {pulso && !Icone && (
          <span className="sinal-pulso block h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
        )}
        {texto}
        {/* Três pontos que pulsam fora de fase: é o desenho universal de
            "alguém está escrevendo", e ele diz *pessoa* sem precisar de rosto. */}
        {pontos && (
          <span className="flex gap-0.5">
            {[0, 0.2, 0.4].map((d) => (
              <span
                key={d}
                className="sinal-pulso block h-1 w-1 rounded-full"
                style={{ background: cor, animationDelay: `${d}s` }}
              />
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

export default function SinaisDeVida({ progresso }) {
  const caixa = useRef(null);
  // SEM `once`: aqui o objetivo é justamente saber quando a cena SAIU, para
  // pausar. É a mesma disciplina do chat das lives e da marca do hero.
  const naTela = useInView(caixa, { amount: 0.1 });

  // Eles pertencem ao ATO 0 e saem ANTES da transformação começar: a partir daí
  // a atenção é da arte se desfazendo, e um chip piscando ali disputaria com
  // ela. A janela termina onde a da frase começa.
  const opacidade = useTransform(progresso, [0.12, JANELAS.fraseSai[0]], [1, 0]);

  return (
    <motion.div
      ref={caixa}
      aria-hidden
      className={`absolute inset-0 pointer-events-none ${naTela ? '' : 'sinais-parados'}`}
      style={{ opacity: opacidade }}
    >
      {/* As ligações ficam ATRÁS dos sinais: elas são o fundo da ideia, e o
          fragmento é o assunto. */}
      <svg
        viewBox="0 0 100 100" preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full hidden md:block"
      >
        {LIGACOES.map(({ de, para, cor, atraso }, i) => (
          <line
            key={i}
            className="traco-de-conexao"
            x1={de[0]} y1={de[1]} x2={para[0]} y2={para[1]}
            stroke={cor} strokeWidth="0.18" vectorEffect="non-scaling-stroke"
            style={{ animationDelay: atraso }}
          />
        ))}
      </svg>

      {SINAIS.map((sinal) => <Sinal key={sinal.id} sinal={sinal} />)}
    </motion.div>
  );
}
