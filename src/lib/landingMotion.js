// Variantes de animação EXCLUSIVAS da Landing — assinatura própria, mais
// "show" que o resto do site. O site usa lib/motion.js (fadeTab, gridCard...)
// para transições discretas; aqui o objetivo é causar impacto na primeira
// impressão. Não duplicar lib/motion.js — esse arquivo é só para a Landing.
//
// Convenção de nomes ('initial'/'animate') igual à de gridContainer/gridCard
// em lib/motion.js — é o que permite a propagação de variants pai → filho
// (o filho herda o estado ativo do pai sem declarar initial/animate próprios).

export const VIEWPORT = { once: true, amount: 0.25 };

export const heroTitle = {
  initial: { opacity: 0, y: 36, letterSpacing: '0.25em', filter: 'blur(10px)' },
  animate: {
    opacity: 1, y: 0, letterSpacing: '0.02em', filter: 'blur(0px)',
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

// Fade-up com atraso configurável — para encadear hero (eyebrow → título → cta)
export const heroFade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: 'easeOut' } },
});

// Reveal de seção ao entrar na viewport ao rolar — use com
// initial="initial" whileInView="animate" viewport={VIEWPORT}
export const fadeUpReveal = {
  initial: { opacity: 0, y: 56 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

// Container com filhos em cascata — filhos usam fadeUpReveal e herdam
// initial/animate do pai por propagação (não declaram os próprios)
export const staggerContainer = (stagger = 0.12) => ({
  initial: {},
  animate: { transition: { staggerChildren: stagger } },
});

// ── `[12/09]` O RODAPÉ: três entradas diferentes, e a diferença é o ponto ───
//
// Pedido do dono: *"não usar simplesmente o mesmo `fadeUpReveal` genérico em
// todos os blocos"*, e a régua junto: *"as animações devem ser calmas e servir
// como uma desaceleração depois do ritmo da landing"*.
//
// Por isso as três desaceleram NA ORDEM em que aparecem — cada bloco se move
// menos e mais devagar que o anterior. O rodapé inteiro é uma frenagem, e a
// última coisa a entrar quase não se move:
//
// | bloco | desloca | dura |
// | --- | --- | --- |
// | assinatura | 22 px | 0,85 s |
// | colunas | 12 px, em cascata | 0,45 s |
// | créditos | 0 px — só opacidade | 0,6 s |
//
// `fadeUpReveal` desloca 56 px em 0,7 s. Usá-lo aqui daria ao epílogo o mesmo
// impulso das cenas, que é o oposto de encerrar.

export const assinaturaDoRodape = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
};

export const colunaDoRodape = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

// Sem deslocamento nenhum: é a última coisa da página, e ela apenas ACENDE.
export const creditosDoRodape = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};

// Painel que abre/fecha ao clicar (alturas animadas)
export const expandPanel = {
  collapsed: { height: 0, opacity: 0 },
  expanded:  { height: 'auto', opacity: 1, transition: { duration: 0.35, ease: 'easeInOut' } },
};
