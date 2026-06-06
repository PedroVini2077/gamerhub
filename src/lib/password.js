// Força de senha (0–4) + rótulos/cores. Fonte única usada em Login e AuthConfirm.

export function getPasswordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

export const STRENGTH_LABELS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
export const STRENGTH_COLORS = ['', '#ff4444', '#ffaa00', '#39ff14bb', '#39ff14'];
