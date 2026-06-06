// Variantes de animação compartilhadas (Framer Motion) — fonte única de verdade
// para manter o mesmo "feel" em todo o site.

export const fadeTab = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

export const gridContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const gridCard = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
};

export const listContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const listItem = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};
