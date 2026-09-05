// Tabelas que NÃO têm policy de UPDATE no banco.
//
// ── Por que esta lista existe no código ─────────────────────────────────────
//
// `UPDATE` negado pela RLS devolve **0 linhas e NENHUM erro**. A tela diz
// "salvo!", o service não reclama, e nada aconteceu. Foi exatamente assim que
// a moderação de comentário e de mural ficou quebrada por MESES sem ninguém
// notar (`docs/regras/POSTURA.md`, fonte de silêncio nº 2).
//
// Tabela sem policy de UPDATE é append-only DE PROPÓSITO — curtida, mídia,
// chat, log. Nenhuma delas devia receber `.update()`. O problema nasce no dia
// em que alguém escreve o primeiro, e o sintoma é uma tela que mente.
//
// O teste `tabelasSemUpdate.test.js` varre `src/` e falha se algum código
// atualizar uma destas. Ele NÃO adivinha: a lista vem do banco.
//
// ── Como regerar (durante auditoria, §6) ───────────────────────────────────
//
//   select t.tablename from pg_tables t
//    where t.schemaname='public'
//      and exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
//                   where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity)
//      and not exists (select 1 from pg_policies p where p.schemaname='public'
//                       and p.tablename=t.tablename and p.cmd in ('UPDATE','ALL'))
//    order by 1;
//
// Conferido em 02/09/2026 (entrou `policy_acceptances`, append-only por
// desenho: registro de consentimento que pode ser reescrito nao prova nada). Se uma tabela GANHAR policy de UPDATE, tire-a
// daqui — senão a lista passa a reprovar um `update` legítimo, e portão que
// acusa errado ensina a ignorar o canal (`CLAUDE.md` §0.2, 4ª regra).
export const TABELAS_SEM_UPDATE = [
  'admin_logs',
  'admin_notification_reads',
  'admin_notifications',
  'comment_likes',
  'community_post_likes',
  'community_post_media',
  'live_chat',
  'live_muted',
  'policy_acceptances',
  'post_likes',
  'post_media',
  'role_change_requests',
  'staff_nominations',
  'unban_requests',
];
