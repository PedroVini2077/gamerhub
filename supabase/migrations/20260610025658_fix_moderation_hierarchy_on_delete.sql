-- Helper de hierarquia de moderação: o ator (auth.uid()) só pode moderar
-- conteúdo de author_id se seu rank for ESTRITAMENTE maior que o do autor.
-- Isso corrige dois bugs de uma vez:
--   1) owner (rank 4) não estava em nenhuma policy de DELETE -> não conseguia
--      moderar nada (e via "sucesso" falso porque RLS bloqueado não é erro);
--   2) admin (rank 2) conseguia deletar conteúdo de super_admin/owner.
CREATE OR REPLACE FUNCTION public.can_moderate_content(author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_rank((SELECT role FROM profiles WHERE id = auth.uid()))
       > role_rank((SELECT role FROM profiles WHERE id = author_id));
$$;

REVOKE EXECUTE ON FUNCTION public.can_moderate_content(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_moderate_content(uuid) TO authenticated;

-- posts
DROP POLICY IF EXISTS posts_delete ON public.posts;
CREATE POLICY posts_delete ON public.posts
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR public.can_moderate_content(user_id)
  );

-- comments
DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_delete ON public.comments
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR public.can_moderate_content(user_id)
  );

-- community_posts (mural)
DROP POLICY IF EXISTS community_posts_delete ON public.community_posts;
CREATE POLICY community_posts_delete ON public.community_posts
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR public.can_moderate_content(user_id)
  );

-- live_chat: autor da msg OU dono da live (modera o próprio espaço) OU hierarquia
DROP POLICY IF EXISTS "Dono e admin deletam mensagens" ON public.live_chat;
CREATE POLICY "Dono e admin deletam mensagens" ON public.live_chat
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_chat.post_id)
    OR public.can_moderate_content(user_id)
  );
;
