-- ═══════════════════════════════════════════════════════════════════════════
-- Auditoria ago/2026 — 3 furos de RLS confirmados por teste com ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════

-- F1 (CRÍTICO) — post_media aceitava INSERT de QUALQUER usuário autenticado
-- em QUALQUER post (`WITH CHECK (auth.uid() IS NOT NULL)`). Dava pra pendurar
-- imagem/vídeo arbitrário no post de outra pessoa (inclusive do dono do site),
-- e como a `url` é texto livre, apontar pro servidor do atacante e registrar
-- IP/User-Agent de todo mundo que abrisse o feed.
-- `community_post_media` já fazia a checagem certa — o feed é que estava aberto.
DROP POLICY IF EXISTS "Auth insere midia" ON public.post_media;
CREATE POLICY "Dono do post insere midia" ON public.post_media FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = post_media.post_id)
  );

-- F2 — `posts_update` deixava o autor mexer em QUALQUER coluna, inclusive
-- `hidden_at` / `deleted_at` (desfazer moderação) e `user_id` (forjar autoria).
-- Hoje isso só não era explorável porque `posts_select` esconde post moderado
-- do próprio autor — proteção ACIDENTAL, que some no dia em que alguém
-- (legitimamente) mostrar ao autor que o post dele foi ocultado.
-- Guard explícito, mesmo padrão do `guard_profile_privileged_cols` já existente.
-- Admin+ e funções SECURITY DEFINER (soft_delete_post, restore_post, moderação)
-- passam direto: dentro delas `current_user` é o dono da função, não o papel do
-- cliente.
CREATE OR REPLACE FUNCTION public.guard_post_privileged_cols()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon')
     AND role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    NEW.user_id    := OLD.user_id;
    NEW.hidden_at  := OLD.hidden_at;
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_post_privileged ON public.posts;
CREATE TRIGGER trg_guard_post_privileged
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_privileged_cols();

-- F3 — `comments` e `community_posts` não tinham NENHUMA policy de UPDATE, e
-- RLS nega por padrão: `hideContent`/`restoreContent` do painel de moderação
-- afetavam 0 linhas silenciosamente (o cliente nem checava o retorno). Ou seja,
-- ocultar comentário e mensagem de mural pelo painel simplesmente não
-- funcionava. Só admin+ pode atualizar — usuário comum não edita comentário.
DROP POLICY IF EXISTS comments_update_mod ON public.comments;
CREATE POLICY comments_update_mod ON public.comments FOR UPDATE TO authenticated
  USING      (role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2)
  WITH CHECK (role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2);

DROP POLICY IF EXISTS community_posts_update_mod ON public.community_posts;
CREATE POLICY community_posts_update_mod ON public.community_posts FOR UPDATE TO authenticated
  USING      (role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2)
  WITH CHECK (role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2);;
