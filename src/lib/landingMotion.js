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

// Painel que abre/fecha ao clicar (alturas animadas)
export const expandPanel = {
  collapsed: { height: 0, opacity: 0 },
  expanded:  { height: 'auto', opacity: 1, transition: { duration: 0.35, ease: 'easeInOut' } },
};
