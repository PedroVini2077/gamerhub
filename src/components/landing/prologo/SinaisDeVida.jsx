import { useRef } from 'react';
import { motion, useTransform, useInView } from 'framer-motion';
import { Heart, KeyRound, Users, MessageCircle, Trophy, Tv } from 'lucide-react';
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
 * ── `[12/09]` Eram seis e ficaram NOVE, e maiores ──────────────────────────
 *
 * Correção pedida por ele depois de ver no telefone: *"gostei das animações do
 * ato 0, eu só achei muito sutis... será que deixar esses elementos maiores, ou
 * colocar mais, atrapalharia? Pq o começo é tudo parado mesmo, então precisa
 * ter movimento"*.
 *
 * Ele tem razão e o erro foi meu de calibragem, não de conceito: eu mirei em
 * *"mais descoberta do que percebida"* — que era o pedido original — e passei do
 * ponto para o lugar onde a cena acontece. **O ATO 0 é a única tela da landing
 * em que nada mais se move**: a arte está parada, a frase está parada, e não há
 * rolagem acontecendo. Numa tela assim, "sutil" vira "nada".
 *
 * O que mudou, e nada disso é novo tipo de elemento:
 *
 * | | antes | agora |
 * | --- | --- | --- |
 * | quantidade | 6 | **9** |
 * | ciclo | 16 s | **13 s** |
 * | na tela ao mesmo tempo | ~2 | **~3** |
 * | tamanho do texto | 0,58 rem | **0,7 rem** |
 * | no celular | 3 dos 6 | **6 dos 9** |
 *
 * O que NÃO mudou é o que importa: continuam sendo fragmentos do produto, e a
 * regra dele segue de pé — **ARTE + CAMADA DE PRODUTO ANIMADA**, nunca efeito
 * genérico. Ficaram mais visíveis, não mais barulhentos.
 *
 * `soCompleto` esconde o sinal no celular. Nove sobre uma arte em pé viram
 * poluição — a composição de retrato tem menos espaço livre.
 */
/**
 * ── `[12/09]` Cada sinal se ancora pelo lado de que ele se APROXIMA ─────────
 *
 * Correção de um bug que o dono viu no telefone: *"alguns dos css estão
 * cortadas no celular, não estão dentro da cena"*.
 *
 * A causa é a soma de duas escolhas minhas que se contradizem: o chip é
 * posicionado por `left` e tem `whitespace-nowrap`. Ancorado em `left-[74%]`
 * ele **cresce para a direita** a partir dali — e a largura dele depende do
 * texto, não do espaço que sobra. Num monitor de 1440 px sobram 374 px depois
 * de 74%; num telefone de 400 px sobram 104, e "key liberada" precisa de 117.
 *
 * O erro é de raciocínio, não de número: eu tinha escolhido as posições
 * olhando o desenho no computador, e posição em porcentagem NÃO leva a largura
 * do conteúdo junto.
 *
 * **A regra agora:** sinal do lado direito se ancora por `right`, então ele
 * cresce **para dentro** da tela. Ajustar um texto deixa de poder empurrá-lo
 * para fora, em qualquer largura de tela. Tem trava.
 */
const SINAIS = [
  {
    id: 'curtida', lado: 'esq', x: '10%', y: '24%', atraso: '0s', cor: '#39ff14',
    icone: Heart, texto: '+1 curtida',
  },
  {
    id: 'digitando', lado: 'dir', x: '6%', y: '17%', atraso: '1.5s', cor: '#00ffff',
    texto: 'alguém está digitando', pontos: true,
  },
  {
    id: 'online', lado: 'esq', x: '6%', y: '52%', atraso: '3s', cor: '#39ff14',
    icone: Users, texto: '2.1 mil online', pulso: true,
  },
  {
    id: 'comentario', lado: 'dir', x: '9%', y: '32%', atraso: '4.4s', cor: '#00ffff',
    icone: MessageCircle, texto: 'novo comentário', soCompleto: true,
  },
  {
    id: 'key', lado: 'dir', x: '7%', y: '45%', atraso: '5.8s', cor: '#ffa33a',
    icone: KeyRound, texto: 'key liberada',
  },
  {
    // `pulso` sem ícone: no print o chip só de texto sumia contra a parte
    // escura da arte — faltava uma âncora de cor. O ponto resolve sem
    // acrescentar mais um ícone à cena.
    id: 'xp', lado: 'esq', x: '18%', y: '68%', atraso: '7.2s', cor: '#bf00ff',
    texto: '+20 XP', pulso: true,
  },
  {
    id: 'live', lado: 'dir', x: '12%', y: '62%', atraso: '8.6s', cor: '#ff4d4d',
    icone: Tv, texto: 'entrou ao vivo', pulso: true,
  },
  {
    id: 'rank', lado: 'esq', x: '11%', y: '38%', atraso: '10s', cor: '#22d3ee',
    icone: Trophy, texto: 'subiu para Elite', soCompleto: true,
  },
  {
    id: 'squad', lado: 'dir', x: '14%', y: '76%', atraso: '11.4s', cor: '#bf00ff',
    icone: Users, texto: 'squad montado', soCompleto: true,
  },
];

/**
 * As ligações, em coordenadas de 0 a 100 — as MESMAS posições dos sinais acima.
 * Escritas aqui e não derivadas porque o SVG tem sistema próprio: derivar
 * exigiria medir o elemento no DOM, que é trabalho por quadro para desenhar
 * três linhas que ninguém mede.
 */
const LIGACOES = [
  { de: [14, 26], para: [50, 46], cor: '#39ff14', atraso: '0s' },
  { de: [66, 19], para: [50, 46], cor: '#00ffff', atraso: '0.7s' },
  { de: [9, 54], para: [50, 46], cor: '#39ff14', atraso: '1.4s' },
  { de: [76, 47], para: [50, 46], cor: '#ffa33a', atraso: '2.1s' },
  { de: [24, 70], para: [50, 46], cor: '#bf00ff', atraso: '2.8s' },
];

function Sinal({ sinal }) {
  const { lado, x, y, atraso, cor, icone: Icone, texto, pulso, pontos, soCompleto } = sinal;

  return (
    <div
      className={`sinal-de-vida absolute ${soCompleto ? 'hidden md:block' : ''}`}
      // A âncora vai em `style`, e não em classe: `left-[10%]` é gerado pelo
      // Tailwind a partir do texto que ele encontra no arquivo, e valor vindo
      // de variável não é encontrado — a classe simplesmente não existiria no
      // CSS, e o chip pousaria no canto superior esquerdo sem erro nenhum.
      style={{ animationDelay: atraso, top: y, [lado === 'dir' ? 'right' : 'left']: x }}
    >
      {/* `[12/09]` O fundo é SÓLIDO, e o `backdrop-blur` saiu junto ─────────
          Pedido dele: *"o fundo é colorido, e o texto com esse balão vazado não
          dá pra enxergar muito... eles não ocupam muito espaço, então não
          atrapalha"*. Ele está certo, e o erro era meu: 78% de opacidade sobre
          a arte funciona na parte escura dela e falha na parte clara — o mesmo
          chip legível num canto e ilegível no outro, que é pior do que
          ilegível sempre, porque não parece defeito.
          O desfoque saiu porque com fundo opaco ele não tem o que desfocar, e
          não era de graça: cada `backdrop-filter` promove o elemento a uma
          camada própria de composição, e eram NOVE por cima de uma arte de tela
          cheia. */}
      <span
        className="flex items-center gap-2 rounded-full border px-3 py-1.5
                   font-mono text-[0.7rem] tracking-wide text-gray-100
                   bg-dark-900 whitespace-nowrap
                   shadow-[0_4px_18px_rgba(0,0,0,0.5)]"
        style={{ borderColor: `${cor}66`, boxShadow: `0 0 14px ${cor}1f` }}
      >
        {Icone && <Icone size={13} style={{ color: cor }} />}
        {pulso && !Icone && (
          <span className="sinal-pulso block h-2 w-2 rounded-full" style={{ background: cor }} />
        )}
        {texto}
        {/* Três pontos que pulsam fora de fase: é o desenho universal de
            "alguém está escrevendo", e ele diz *pessoa* sem precisar de rosto. */}
        {pontos && (
          <span className="flex gap-0.5">
            {[0, 0.2, 0.4].map((d) => (
              <span
                key={d}
                className="sinal-pulso block h-1.5 w-1.5 rounded-full"
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
            // `1.1` e não `0.18`: com `non-scaling-stroke` a espessura é em
            // PIXEL DE TELA, não em unidade do `viewBox`. 0,18 px é literalmente
            // invisível — foi assim que as ligações nasceram, e o print do dono
            // ("achei muito sutis") estava vendo isso também, não só o tamanho
            // dos chips. A convergência do hero usa 1,4 pelo mesmo motivo.
            stroke={cor} strokeWidth="1.1" vectorEffect="non-scaling-stroke"
            style={{ animationDelay: atraso }}
          />
        ))}
      </svg>

      {SINAIS.map((sinal) => <Sinal key={sinal.id} sinal={sinal} />)}
    </motion.div>
  );
}
