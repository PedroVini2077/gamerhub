// Variantes de animação compartilhadas (Framer Motion) — fonte única de verdade
// para manter o mesmo "feel" em todo o site.

export const fadeTab = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -3, transition: { duration: 0.1 } },
};

export const gridContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export const gridCard = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

export const listContainer = {
  animate: { transition: { staggerChildren: 0.03 } },
};

export const listItem = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
};
