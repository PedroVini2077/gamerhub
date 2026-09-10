import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

/**
 * As duas maneiras de o site ENCERRAR uma sessão.
 *
 * ── Por que saíram do `useAuth.jsx` ─────────────────────────────────────────
 *
 * `[10/09]` O hook passou de 274 para 305 linhas quando o SEC-006 entrou (a
 * limpeza de cache na troca de conta), e o §4 manda dividir o que eu mesmo
 * inchei — antes de entregar, não depois.
 *
 * A fatia não foi escolhida por tamanho: as duas respondem à mesma pergunta —
 * *"como este site encerra uma sessão, e por que de cada jeito"* — e as duas
 * carregam a explicação de uma decisão do dono. Ficam melhor juntas, e fora do
 * hook, que trata de ESTADO.
 *
 * Elas recebem o que precisam por parâmetro em vez de ler estado: assim se leem
 * de cima a baixo sem abrir o `useAuth`, e continuam testáveis.
 */

/**
 * O "Sair" do cabeçalho — encerra a sessão **deste aparelho só**.
 *
 * ── `[05/09]` Era GLOBAL, e a decisão do dono mudou isso ────────────────────
 *
 * O padrão do `supabase-js` é `scope: 'global'`: ele revoga **todos** os
 * refresh tokens da conta, então sair no celular derrubava o PC junto. Estava
 * escrito como intencional — *"o certo inclusive em aparelho compartilhado"* —
 * e o dono desmontou o argumento:
 *
 * > *"não faz sentido, a não ser que tenha uma aba pra identificar dispositivos
 * > conectados, tipo Instagram… como no nosso site não tem nada disso, não faz
 * > sentido eu deslogar no celular e sair no PC"*.
 *
 * **Ele está certo, e o motivo é que a proteção era CEGA.** Derrubar todas as
 * sessões só protege quem sabe que existe uma sessão indevida — e é exatamente
 * isso que este site não tem como contar a ninguém. Sem essa informação, o
 * botão nunca expulsou invasor nenhum; só derrubava a própria pessoa no outro
 * aparelho.
 *
 * **O que se perde:** o caso "quero matar todas as sessões de longe". Para ele
 * a resposta é **trocar a senha**, que revoga no servidor — e é por isso que a
 * saída de `AuthConfirm.jsx` continua global.
 *
 * A trava é `logoutEhLocal.test.js`.
 */
export async function encerrarSessao({ username, aoLimpar }) {
  if (username) {
    logAudit('auth_logout', `@${username} fez logout`, { category: 'auth' });
  }
  await supabase.auth.signOut({ scope: 'local' });
  aoLimpar();
}

/**
 * A saída de quem foi BANIDO: encerra e força recarregar a página.
 *
 * O destino é a LANDING, não o `/login`. Ela é a porta de entrada e a única
 * página que não depende do banco. Jogar quem acabou de ser recusado no
 * formulário de login sugere tentar de novo o que acabou de dar errado.
 *
 * ── `[28/08]` NÃO espera a ida ao servidor, e o motivo está medido ──────────
 *
 * O dono relatou demora ao clicar em "Sair agora". A causa era o escopo global:
 * uma ida ao servidor para revogar os refresh tokens antes de trocar de página.
 * Medido contra produção, 5 chamadas: **0,30 s a 1,08 s** — e isso de um
 * datacenter com conexão quente. No 4G de um celular é bem pior.
 *
 * **Por que abrir mão da revogação global aqui é seguro:** o refresh token
 * continua válido e não serve para nada. A conta está BANIDA — a RLS nega tudo,
 * e qualquer sessão que reapareça cai na `BannedScreen` de novo. Além disso é o
 * token da própria pessoa, no aparelho dela: bastaria não clicar em sair.
 */
export async function encerrarSessaoDeBanido({ username }) {
  if (username) {
    logAudit('auth_logout', `@${username} fez logout`, { category: 'auth' });
  }
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch { /* o redirect abaixo garante o estado limpo */ }
  window.location.replace('/');
}
