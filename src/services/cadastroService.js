import { supabase } from '../lib/supabase';
import { aceitesParaGravar } from '../lib/documentosLegais';

/**
 * O CADASTRO — criar conta, do zero até a prova do aceite.
 *
 * ── Por que saiu do `useAuth.jsx` em 03/09 ─────────────────────────────────
 *
 * Duas razões, e a segunda é a que manda.
 *
 * A primeira é tamanho: com a correção dos campos extras, o `useAuth.jsx`
 * passou de 300 linhas, e o §4 é claro — arquivo que eu inchei, eu divido
 * antes de entregar.
 *
 * A segunda é que `useAuth` é **o arquivo de maior risco do projeto** (§7):
 * quebrar ele derruba o site inteiro para quem está logado. Ele cuida de
 * SESSÃO — quem está logado, quem foi banido, quando a sessão morre. Criar
 * conta é outro assunto: acontece **antes** de existir sessão, e é justamente
 * por isso que os dois bugs abaixo passaram despercebidos ali dentro.
 *
 * Aqui o cadastro fica com um arquivo só dele, e o `useAuth` volta a ter um
 * assunto só.
 *
 * ── Os dois bugs que este arquivo carrega a memória ─────────────────────────
 *
 * **1. O `UPDATE` que nunca funcionou e nunca reclamou.** Os campos extras
 * eram gravados com `from('profiles').update(...)` logo depois do `signUp`.
 * Sem sessão (confirmação de e-mail ligada), aquilo roda como `anon`, e a
 * policy de UPDATE é `TO authenticated`: **0 linhas, nenhum erro**. E como
 * `birth_date` nunca chegava ao banco, o `guard_idade_minima` nunca disparava
 * — a idade mínima de 13 anos não era imposta em lugar nenhum.
 *
 * **2. O `select` que mantinha `profiles` aberto ao anônimo.** A checagem de
 * username duplicado era o único motivo de `anon` ter `SELECT (id, username)`,
 * e o PostgREST não obriga a filtrar: `select=id,username` devolvia a lista
 * inteira.
 *
 * A trava dos dois está em `hooks/__tests__/cadastroSemSelectEmProfiles.test.js`,
 * e ela varre ESTE arquivo.
 */

/**
 * A regra de username, e ela existe nos DOIS lados de propósito.
 *
 * Aqui ela dá a mensagem em português antes de gastar uma ida ao servidor; no
 * banco, `username_disponivel` aplica a mesma expressão — porque o site entrega
 * a anon key e validação de cliente não vale nada sozinha (§1.3). O teste de
 * contrato falha se as duas divergirem.
 */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;

export async function criarConta(email, password, username, extraFields = {}) {
  if (!email?.trim()) {
    return { error: { message: 'Informe um email válido.' } };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { error: { message: 'Username: 3-20 caracteres, apenas letras minúsculas, números e _' } };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: { message: `Senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` } };
  }

  // `[03/09]` RPC em vez de `select('id').eq('username', …)`.
  //
  // Aquele `select` era o ÚNICO motivo de `anon` ter `SELECT (id, username)`
  // em `profiles` — e o PostgREST não obriga a filtrar: `select=id,username`
  // devolvia as 5 linhas de uma vez. Somado a `site_config.updated_by`, isso
  // ligava um UUID de staff a um nome, sem conta nenhuma.
  //
  // A RPC responde a mesma pergunta sem entregar a lista, e o `SELECT` de
  // `anon` em `profiles` foi revogado junto.
  const { data: livre, error: erroUsername } = await supabase
    .rpc('username_disponivel', { p_username: username });

  // Erro aqui NÃO passa batido: sem esta checagem, uma RPC fora do ar deixaria
  // `livre` indefinido e o cadastro seguiria para o `signUp` sem nunca ter
  // conferido o username — que é o §1.5 na porta de entrada do site.
  if (erroUsername) {
    return { error: { message: 'Não deu para conferir o username agora. Tente de novo.' } };
  }
  if (!livre) {
    return { error: { message: 'Este username já está em uso. Escolha outro.' } };
  }

  // ── `[03/09]` Os campos extras vão no METADATA, e não num UPDATE depois ──
  //
  // O que estava aqui: um `supabase.from('profiles').update(...)` logo depois
  // do `signUp`. **Nunca funcionou, e nunca reclamou.**
  //
  // Com confirmação de e-mail ligada, o `signUp` não devolve sessão — então
  // aquele UPDATE rodava como `anon`, e a única policy de UPDATE de
  // `profiles` é `TO authenticated`. Medido em ROLLBACK: **0 linhas afetadas
  // e nenhum erro**. O código checava `error`, que vinha nulo, e seguia.
  // É o §4 ("`count: 'exact'` + tratar 0 linhas como erro — RLS nega em
  // silêncio") somado ao §1.5, na porta de entrada do site.
  //
  // **A consequência era maior que os três campos:** `birth_date` nunca
  // chegava ao banco, e o `guard_idade_minima` dispara em
  // `INSERT OR UPDATE OF birth_date`. Sem o valor, ele nunca disparava — a
  // idade mínima de 13 anos existia no formulário, no banco e na política de
  // privacidade, e não era imposta em lugar nenhum. Prova: 3 dos 5 perfis
  // estavam com `birth_date` nulo.
  //
  // No metadata, o `handle_new_user` (que é `SECURITY DEFINER`) escreve os
  // campos no próprio INSERT do perfil: sem RLS no caminho, e com a validação
  // de idade disparando de verdade. Se a pessoa for menor de 13, o cadastro
  // agora **falha**, com a mensagem do banco.
  const permitidos = ['birth_date', 'state', 'platform'];
  const extras = Object.fromEntries(
    Object.entries(extraFields).filter(([k, v]) => permitidos.includes(k) && v),
  );

  // `[11/09]` O ACEITE vai no metadata, e quem grava é o banco.
  //
  // A versão anterior chamava `registrarAceiteDosDocumentos` logo depois do
  // `signUp` — e ela **falhava sempre**, num site com confirmação de email
  // ligada. O motivo: `signUp` cria o usuário e NÃO abre sessão, então o
  // cliente continua sendo `anon`, e a policy de INSERT de
  // `policy_acceptances` é `TO authenticated` com `user_id = auth.uid()`.
  //
  // Provado em ROLLBACK, nos dois papéis: `anon` recebe
  // "permission denied for table policy_acceptances" e `authenticated` sem
  // `sub` recebe violação de RLS. E o dado confirmou: a conta criada em 28/08
  // tem 0 aceites, contra 3, 4 e 8 das anteriores.
  //
  // Agora o `handle_new_user` escreve o aceite na MESMA transação que cria a
  // conta. Só as coordenadas viajam no metadata — `documento` e `versao` —, e
  // o trigger valida cada uma contra os `CHECK` da tabela antes de gravar.
  const aceites = aceitesParaGravar('x').map(({ documento, versao }) => ({ documento, versao }));

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username, ...extras, aceites } },
  });
  if (error) return { error };

  return { data };
}
