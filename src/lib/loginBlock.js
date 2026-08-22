// Estado de bloqueio de login — fonte única.
//
// A mesma expressão estava escrita à mão em `pages/Login.jsx` e em
// `components/auth/LoginForm.jsx`. Duas cópias da regra que decide se alguém
// consegue entrar no site: se uma mudasse e a outra não, a tela e o submit
// discordariam sobre quem está bloqueado.
//
// Também tira o `Date.now()` de dentro do corpo dos componentes, que o lint
// acusava como chamada impura durante o render.

/** A pessoa está impedida de entrar agora? */
export function isLoginBlocked(block) {
  if (!block) return false;
  if (block.permanent) return true;
  if (!block.blocked_until) return false;
  return new Date(block.blocked_until).getTime() > Date.now();
}

/** Segundos que faltam para o bloqueio temporário expirar (0 se não há). */
export function segundosRestantes(block) {
  if (!block?.blocked_until || block.permanent) return 0;
  const ms = new Date(block.blocked_until).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}
