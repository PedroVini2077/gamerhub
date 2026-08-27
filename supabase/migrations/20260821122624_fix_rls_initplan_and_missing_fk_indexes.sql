-- P3-5 — 3 políticas ainda chamavam `auth.uid()` solto, reavaliado LINHA A
-- LINHA. O projeto já tinha padronizado `(select auth.uid())` em todas as
-- outras (ver BACKLOG); estas três passaram batido. Mesma lógica, só o
-- envelope muda.
DROP POLICY IF EXISTS role_change_requests_select ON public.role_change_requests;
CREATE POLICY role_change_requests_select ON public.role_change_requests FOR SELECT
  USING (
    ((SELECT auth.uid()) = requested_by)
    OR EXISTS (SELECT 1 FROM profiles
               WHERE profiles.id = (SELECT auth.uid())
                 AND profiles.role = ANY (ARRAY['super_admin','owner']))
  );

DROP POLICY IF EXISTS staff_nominations_select ON public.staff_nominations;
CREATE POLICY staff_nominations_select ON public.staff_nominations FOR SELECT
  USING (
    ((SELECT auth.uid()) = candidate_id)
    OR ((SELECT auth.uid()) = nominated_by)
    OR EXISTS (SELECT 1 FROM profiles
               WHERE profiles.id = (SELECT auth.uid())
                 AND profiles.role = ANY (ARRAY['super_admin','owner']))
  );

DROP POLICY IF EXISTS modq_insert ON public.moderation_queue;
CREATE POLICY modq_insert ON public.moderation_queue FOR INSERT
  WITH CHECK (
    role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2
    OR (SELECT current_setting('role', true)) = 'supabase_admin'
  );

-- P3-6 — 9 chaves estrangeiras sem índice de cobertura. Importa especialmente
-- agora que `live_chat_timeouts.created_by` e `site_config.updated_by` viraram
-- ON DELETE SET NULL: sem índice, apagar um usuário obriga o Postgres a varrer
-- a tabela inteira em busca de referências.
CREATE INDEX IF NOT EXISTS idx_blocked_words_created_by        ON public.blocked_words        (created_by);
CREATE INDEX IF NOT EXISTS idx_community_post_likes_user       ON public.community_post_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_reviewed_by    ON public.moderation_queue     (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_rcr_requested_by                ON public.role_change_requests (requested_by);
CREATE INDEX IF NOT EXISTS idx_rcr_reviewed_by                 ON public.role_change_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_staff_nom_final_decided_by      ON public.staff_nominations    (final_decided_by);
CREATE INDEX IF NOT EXISTS idx_staff_nom_nominated_by          ON public.staff_nominations    (nominated_by);
CREATE INDEX IF NOT EXISTS idx_staff_nom_reviewed_by           ON public.staff_nominations    (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_violations_reviewed_by          ON public.violations           (reviewed_by);;
