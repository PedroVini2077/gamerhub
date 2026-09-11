/**
 * As mensagens de erro do login e do cadastro, em português.
 *
 * ── O que o dono viu ────────────────────────────────────────────────────────
 *
 * `[11/09]` Print do celular dele: cinco caixas empilhadas dizendo
 * **"Invalid login credentials"** — em inglês, num site inteiramente em
 * português, e uma por clique.
 *
 * A causa era literal: `toast.error(error.message)` em três pontos do
 * `Login.jsx`. `error.message` é o texto **cru do Supabase**, que não tem
 * tradução e nunca teve. Quem erra a senha no celular do dono não faz ideia do
 * que "Invalid login credentials" quer dizer.
 *
 * ── Por que um MAPA, e não um `else` genérico ───────────────────────────────
 *
 * O §4 proíbe fallback silencioso, e aqui a tentação era exata: mandar tudo o
 * que não conheço para um "Erro ao entrar". Isso **esconde** a mensagem que
 * explicaria o problema — e some justamente no caso novo, que é quando ela
 * importa.
 *
 * Então o desconhecido **não é engolido**: ele aparece na tela com o texto
 * original junto. Feio de propósito. Ver um inglês solto na tela é o sinal de
 * que falta uma entrada aqui — e esse sinal existir é melhor do que um
 * "ocorreu um erro" que não ensina nada a ninguém.
 */

/**
 * As mensagens que o Supabase Auth devolve de verdade nos caminhos que este
 * site usa: entrar, cadastrar e recuperar senha.
 *
 * A chave é comparada em minúsculas e sem espaço nas pontas, porque o texto do
 * GoTrue já mudou de caixa entre versões.
 */
const TRADUCOES = {
  'invalid login credentials': 'E-mail ou senha incorretos.',
  'email not confirmed': 'Confirme seu e-mail antes de entrar — o link está na sua caixa de entrada.',
  'user already registered': 'Já existe uma conta com este e-mail.',
  'a user with this email address has already been registered':
    'Já existe uma conta com este e-mail.',
  'password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  'unable to validate email address: invalid format': 'Esse e-mail não parece válido.',
  'email rate limit exceeded':
    'Muitos e-mails enviados para este endereço. Aguarde alguns minutos.',
  'over_email_send_rate_limit':
    'Muitos e-mails enviados para este endereço. Aguarde alguns minutos.',
  'for security purposes, you can only request this after 60 seconds':
    'Aguarde um minuto antes de pedir de novo.',
  'signups not allowed for this instance': 'O cadastro está temporariamente fechado.',
  'user not found': 'Não encontramos uma conta com este e-mail.',
  'new password should be different from the old password':
    'A nova senha precisa ser diferente da anterior.',
};

/**
 * O que mostrar para a pessoa, a partir do erro que o Supabase devolveu.
 *
 * @param {{ message?: string } | null | undefined} erro
 * @returns {string}
 */
export function mensagemDeErroDeAuth(erro) {
  const bruto = (erro?.message ?? '').trim();
  if (!bruto) {
    // Sem mensagem nenhuma é o caso de rede caída — e dizer "senha incorreta"
    // aqui mandaria a pessoa trocar uma senha que está certa (§1.5: toda
    // mensagem de erro tem que ser verdadeira).
    return 'Não deu para falar com o servidor. Verifique sua conexão e tente de novo.';
  }

  const conhecida = TRADUCOES[bruto.toLowerCase()];
  if (conhecida) return conhecida;

  // O desconhecido aparece INTEIRO. Ver isto na tela é o pedido para
  // acrescentar a entrada no mapa acima.
  return `Não deu para concluir: ${bruto}`;
}

/**
 * O identificador do toast de autenticação.
 *
 * Com ele, o `react-hot-toast` **substitui** a caixa anterior em vez de
 * empilhar — que foi a segunda metade do print do dono: cinco cliques, cinco
 * caixas, a tela inteira coberta de vermelho.
 */
export const ID_DO_TOAST_DE_AUTH = 'auth';

/** Exportado só para a trava conseguir varrer o mapa. */
export const MENSAGENS_TRADUZIDAS = TRADUCOES;
