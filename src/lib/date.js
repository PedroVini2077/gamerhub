// Idade a partir da data de nascimento + idade mínima de cadastro (LGPD).

export const MIN_SIGNUP_AGE = 13;

// Retorna a idade em anos (inteiro) ou null se não houver data.
export function calcAge(birthDate) {
  if (!birthDate) return null;
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}

// Tempo relativo curto em pt-BR ("agora", "há 5 min", "há 3 h", "há 2 d").
// Acima de ~6 dias cai pra data curta (dd/mm). Usado em listagens (mural, feed).
export function timeAgo(date) {
  if (!date) return '';
  const diffMs = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day <= 6) return `há ${day} d`;
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
