-- SEC-053 — o BANIMENTO de um membro da equipe não alcançava as policies.
--
-- O QUE FOI MEDIDO (ROLLBACK, papel `authenticated` real, admin BANIDO):
--
--   lê a fila de moderação ....... 20 itens      lê a trilha ..... 4.102 linhas
--   lê denúncias .................  2            lê avisos ....... 207
--   ESCREVE na wordlist .......... conseguiu     mexe na fila .... 20 linhas
--   vê post oculto/apagado ....... 16            vê comentário ... 14
--
-- A CAUSA. `is_staff()` e `is_super()` JÁ embutem `operador_ativo()`:
--
--   is_staff()  =  role_rank(...) >= 2  AND  operador_ativo()
--
-- Estas 23 policies reimplementavam a PRIMEIRA metade à mão — `role_rank(...)
-- >= 2`, ou a lista literal ARRAY['admin','super_admin','owner'] — e perdiam a
-- segunda. O `CLAUDE.md` já dizia "hierarquia nunca se escreve à mão", e a
-- razão registrada lá era outra (esquecer o `owner`, 3x). Esta é a terceira
-- razão, e é pior: não falta um cargo, falta a pergunta "quem chama ainda está
-- apto?".
--
-- O SEC-043 fez exatamente isto nas RPCs em 19/09. A regra foi aplicada em
-- METADE do sistema — as funções — e as policies ficaram para trás. É o padrão
-- que o próprio backlog batizou de "a mesma regra aplicada pela metade".
--
-- POR QUE É GRAVE. `ban_user` não revoga sessão: ele escreve `banned = true` em
-- `profiles` e mais nada. O token que o moderador já tem continua válido, e o
-- refresh continua funcionando — o GoTrue não conhece `profiles`. Então o
-- banimento, que é justamente o remédio contra um moderador que se voltou
-- contra o site, não tirava dele nenhum dos poderes acima. Pela REST API, sem
-- passar pela tela.
--
-- A SUBSTITUIÇÃO É MECÂNICA e não muda NADA para operador ativo:
--   role_rank(...) >= 2                     -> is_staff()
--   role ANY('admin','super_admin','owner') -> is_staff()
--   role ANY('super_admin','owner')         -> is_super()
--
-- O `owner` NUNCA é trancado para fora: `operador_ativo()` começa com
-- `role = 'owner' OR ...`. Medido junto, porque foi assim que três correções de
-- segurança anteriores derrubaram o site.
--
-- DEPOIS (mesmo admin, banido): 0 / 0 / 0 / 0 / bloqueado / 0 / 0 / 0 —
-- idêntico a um usuário comum. Não trancado: REBAIXADO, que é o correto.
--
-- FORA DESTE ESCOPO, de propósito: `blocked_words_select` continua `USING
-- (true)`. Fechá-la quebraria o aviso que o compositor, o mural, os comentários
-- e o chat mostram ANTES de enviar — todos leem a lista pelo cliente
-- (`useBlockedWords`). É item de backlog com o trade-off escrito, não um
-- esquecimento.

ALTER POLICY admin_logs_select ON admin_logs USING (is_staff());

ALTER POLICY admins_insert_logs ON admin_logs
  WITH CHECK (admin_id = (SELECT auth.uid()) AND actor_id = (SELECT auth.uid()) AND is_staff());

ALTER POLICY admins_insert_reads ON admin_notification_reads
  WITH CHECK (is_staff() AND admin_id = (SELECT auth.uid()));

ALTER POLICY admins_select_notifications ON admin_notifications USING (is_staff());

ALTER POLICY blocked_words_delete ON blocked_words USING (is_staff());
ALTER POLICY blocked_words_insert ON blocked_words WITH CHECK (is_staff());
ALTER POLICY blocked_words_update ON blocked_words USING (is_staff());

ALTER POLICY comments_select ON comments
  USING (((hidden_at IS NULL) AND post_aceita_interacao(post_id)) OR is_staff());

ALTER POLICY comments_update_mod ON comments
  USING (is_staff() AND (can_moderate_content(user_id) OR ((SELECT auth.uid()) = user_id)));

ALTER POLICY community_posts_select ON community_posts
  USING ((hidden_at IS NULL) OR is_staff());

ALTER POLICY community_posts_update_mod ON community_posts
  USING (is_staff() AND (can_moderate_content(user_id) OR ((SELECT auth.uid()) = user_id)));

ALTER POLICY live_chat_select ON live_chat
  USING (post_aceita_interacao(post_id) OR is_staff());

-- O ramo `supabase_admin` fica: é o trigger do servidor enfileirando, não gente.
ALTER POLICY modq_insert ON moderation_queue
  WITH CHECK (is_staff() OR ((SELECT current_setting('role', true)) = 'supabase_admin'));
ALTER POLICY modq_select ON moderation_queue USING (is_staff());
ALTER POLICY modq_update ON moderation_queue USING (is_staff());

ALTER POLICY posts_select ON posts
  USING (((deleted_at IS NULL) OR is_staff()) AND ((hidden_at IS NULL) OR is_staff()));

ALTER POLICY reports_select ON reports
  USING (((SELECT reports.reporter_id) = (SELECT auth.uid())) OR is_staff());
ALTER POLICY reports_update ON reports USING (is_staff());

ALTER POLICY role_change_requests_select ON role_change_requests
  USING (((SELECT auth.uid()) = requested_by) OR is_super());

ALTER POLICY staff_nominations_select ON staff_nominations
  USING (((SELECT auth.uid()) = candidate_id) OR ((SELECT auth.uid()) = nominated_by) OR is_super());

ALTER POLICY unban_req_select_scoped ON unban_requests
  USING ((requesting_admin_id = (SELECT auth.uid())) OR is_super());

ALTER POLICY violations_select ON violations
  USING ((user_id = (SELECT auth.uid())) OR is_staff());
ALTER POLICY violations_update ON violations USING (is_staff());
