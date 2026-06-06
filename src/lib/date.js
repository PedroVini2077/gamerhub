// Idade a partir da data de nascimento + idade mínima de cadastro (LGPD).

export const MIN_SIGNUP_AGE = 13;

// Retorna a idade em anos (inteiro) ou null se não houver data.
export function calcAge(birthDate) {
  if (!birthDate) return null;
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}
