/**
 * As duas listas que a MÁQUINA confere — separadas do texto que a pessoa lê.
 *
 * ── Por que elas saíram do `conteudoDaPrivacidade.js` ───────────────────────
 *
 * `[05/09]` Não foi só tamanho. O arquivo tinha duas responsabilidades muito
 * diferentes morando juntas: o **texto** da página (que muda quando o dono
 * decide como explicar algo) e estas duas **listas de contrato** (que mudam
 * quando o CÓDIGO passa a gravar uma chave nova ou a falar com um terceiro
 * novo). Quem edita uma quase nunca é quem precisa editar a outra.
 *
 * Separá-las torna a pergunta "o que o site guarda hoje?" respondível sem
 * atravessar 250 linhas de política.
 */

/**
 * ── AS LISTAS QUE O SITE NÃO PODE CRESCER SEM ATUALIZAR ─────────────────────
 *
 * Pedido do dono em 01/09: *"o site vai crescer mais, então a gente precisa que
 * essa aba de políticas de privacidade esteja sempre atualizada, sempre mesmo"*.
 *
 * Promessa não serve para isso. Estas duas listas são a versão CONFERÍVEL do
 * que a página afirma, e `conteudoDaPrivacidade.test.js` as cruza com o código:
 * chave de armazenamento nova ou dependência que manda dado para fora reprovam
 * o PR até a política dizer o que passou a acontecer.
 *
 * A tabela acima é para quem lê; estas listas são para a máquina conferir. As
 * duas descrevem a mesma coisa de propósito — o que muda é quem consegue ler.
 */

/** Toda chave que o código do site grava no navegador. */
export const CHAVES_DECLARADAS = [
  'gh_intro_vista',
  'gh_landing_3d',
  'gh_pause_reason',
  'gh_chunk_reload_at',
  'gh_som_ambiente',
  'gh_som_avisado',
  'gh_aceite_adiado',
  // `[04/09]` As duas da tela de boas-vindas. Ver `lib/boasVindas.js`.
  'gh_entrando',
  'gh_ja_entrou:',
  // `[05/09]` As três do cofre do painel do Fundador. Ver `lib/cofre.js`.
  // O código em si nunca é guardado — só um resumo SHA-256 com sal.
  //
  // `[05/09]` ELAS ENTRARAM NA TABELA VISÍVEL TAMBÉM, por decisão do dono.
  //
  // Eu tinha proposto o contrário — elas só nascem no aparelho de quem é
  // fundador, e listá-las descreve para milhares de pessoas um armazenamento
  // que existe para uma. Ele decidiu citar, e a razão dele é mais forte que a
  // minha: a tabela abre dizendo "listados abaixo". Lista que se declara
  // completa e não é deixa de ser verdade para quem lê, e o custo de uma
  // política de privacidade menos verdadeira é maior do que o de três linhas a
  // mais.
  //
  // Custou subir a `versao` do documento: todo mundo reaceita.
  'gh_cofre_resumo',
  'gh_cofre_sal',
  'gh_cofre_aberto',
];

/**
 * Toda dependência que envia dado para fora.
 *
 * O critério é "manda alguma coisa para um servidor de terceiro", não "é
 * biblioteca externa": `framer-motion` anima e não fala com ninguém, então não
 * entra. O que entra é o que faz uma pessoa aparecer no registro de outra
 * empresa.
 */
export const TERCEIROS_DECLARADOS = [
  '@supabase/supabase-js',
  '@sentry/react',
  '@vercel/analytics',
  '@vercel/speed-insights',
  // `[03/09]` NÃO é dependência npm: o Cloudflare Turnstile é um `<script>`
  // buscado em tempo de execução (`lib/turnstile.js`), só na página de contato.
  // Fica escrito aqui porque esta lista é onde se procura "quem recebe alguma
  // coisa" — mas repare que a trava que varre o `package.json` NUNCA o pegaria.
  // Quem vigia terceiro carregado por script é `e2e/terceiro-no-contato.mjs`.
  'cloudflare-turnstile (script, nao e dependencia npm)',
];
