import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { isLoginBlocked } from '../lib/loginBlock';

/**
 * O estado de bloqueio por tentativas, e a consulta que o desfaz sozinho.
 *
 * ── Por que existe a consulta periódica ─────────────────────────────────────
 *
 * Quando a equipe desbloqueia uma conta pelo painel, quem está com a tela aberta
 * não fica sabendo: a mensagem continua dizendo "conta bloqueada" até alguém
 * recarregar. A consulta a cada 8 s reflete o desbloqueio sem recarregar.
 *
 * Ela só roda **enquanto há bloqueio e há e-mail digitado** — fora disso não há
 * pergunta a fazer, e temporizador que roda à toa é o que o §6.1 caça.
 *
 * ── Esta tela só LÊ ─────────────────────────────────────────────────────────
 *
 * `check_login_status` é leitura pura. Quem conta a falha é o banco, avisado
 * pelo Password Verification Hook do Supabase — desde 28/08 não existe mais RPC
 * que o frontend chame para reportar a própria falha. Aquela era chamável por
 * anônimo: bastava um script chamar com o e-mail da vítima para marcar a conta
 * como bloqueada sem nunca saber a senha. **Nada que esta página faça move o
 * contador**, e essa é a propriedade a preservar se alguém mexer aqui.
 */
export function useBloqueioDeLogin(email) {
  // `{ permanent, blocked_until }` ou `null`.
  const [bloqueio, setBloqueio] = useState(null);
  const bloqueado = isLoginBlocked(bloqueio);

  useEffect(() => {
    if (!bloqueado || !email.trim()) return;
    const t = setInterval(async () => {
      const { data } = await supabase.rpc('check_login_status', { p_email: email.trim() });
      if (!data?.blocked) setBloqueio(null);
      else setBloqueio({ permanent: data.permanent, blocked_until: data.blocked_until });
    }, 8000);
    return () => clearInterval(t);
  }, [bloqueado, email]);

  return [bloqueio, setBloqueio];
}
