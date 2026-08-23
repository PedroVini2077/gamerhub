// Tabelas que estão na publicação `supabase_realtime` do banco.
//
// Por que esta lista existe no código: assinar uma tabela que NÃO está
// publicada não dá erro nenhum. O canal conecta, o `subscribe()` responde
// SUBSCRIBED, e simplesmente nenhum evento chega — para sempre. Foi assim que
// `unban_requests` e `live_reactivation_requests` ficaram com assinatura morta
// no painel admin sem ninguém notar: a tela prometia atualizar sozinha e nunca
// atualizava.
//
// O teste `realtimeTables.test.js` varre o código atrás de toda assinatura e
// falha se alguma tabela não estiver aqui. Ao adicionar uma assinatura nova:
//   1. `ALTER PUBLICATION supabase_realtime ADD TABLE public.<tabela>;`
//   2. acrescente o nome aqui.
//
// Manter a lista enxuta é decisão de custo: realtime cobra por
// (mudanças × conexões). Tabela de alto volume (`admin_logs`) ou que ninguém
// assina (`post_media`) já foi tirada daqui de propósito — ver BACKLOG §C3-b.
export const TABELAS_REALTIME = [
  'admin_notifications',
  'community_posts',
  'live_chat',
  'live_chat_timeouts',
  'live_reactivation_requests',
  'moderation_queue',
  'posts',
  'profiles',
  'site_config',
  'unban_requests',
];

// Deliberadamente FORA do realtime — a UI atualiza por refetch. Está aqui para
// que a decisão fique escrita, e não pareça esquecimento na próxima leitura:
//
// - `comments`, `post_likes`, `comment_likes`, `community_post_likes`:
//   são as tabelas mais quentes do site. Publicá-las significaria uma mensagem
//   para CADA pessoa com o feed aberto a cada curtida — o custo cresce com
//   (curtidas × leitores). O feed já resolve curtidas e comentários em duas
//   consultas em lote e revalida ao voltar o foco.
// - `notifications`: o sino revalida no `visibilitychange` e ao abrir o painel.
// - `admin_logs`: tabela de auditoria de alto volume, transmitida a todo admin
//   conectado mesmo com a aba fechada. Trocada por poll só com a aba visível.
// - `post_media`: ninguém assinava; a UI já refaz a busca da mídia.
export const FORA_DO_REALTIME_DE_PROPOSITO = [
  'comments', 'post_likes', 'comment_likes', 'community_post_likes',
  'notifications', 'admin_logs', 'post_media',
];
