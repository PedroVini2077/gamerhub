-- O FUNDADOR ESTAVA EXCLUIDO DE 14 POLICIES.
--
-- Sintomas relatados: "nao consigo encerrar a live pela area de lives",
-- "deu erro ao silenciar usuarios", "encerro a live pelo painel, aparece que
-- encerrou, mas a live continua".
--
-- Causa: 14 policies escreveram a lista de papeis A MAO como
-- `role = ANY(ARRAY['admin','super_admin'])`, esquecendo `owner`. O fundador,
-- que e o papel MAIS ALTO do site, ficava de fora de operacoes que qualquer
-- admin pode fazer.
--
-- O "aparece que encerrou mas continua" e o mesmo veneno de sempre: a RLS nega
-- devolvendo ZERO LINHAS e nenhum erro, o cliente checa so `error` e canta
-- vitoria. (O lado do cliente e corrigido em commit proprio.)
--
-- Esta e a TERCEIRA vez que este padrao aparece — antes em `admin_unlock_login`
-- (barrava o proprio fundador) e na policy de INSERT de `admin_logs`. A causa
-- de fundo e sempre a mesma: cada lugar reescreve a hierarquia por extenso em
-- vez de usar `role_rank`, que ja existe e ja sabe que owner = 4.
--
-- Correcao de fundo: dois helpers que passam a ser a fonte unica de "quem e
-- staff". Ninguem mais precisa lembrar de incluir `owner`.
--
--   is_staff()  -> admin, super_admin, owner   (role_rank >= 2)
--   is_super()  -> super_admin, owner          (role_rank >= 3)
--
-- Testado em ROLLBACK: fundador encerra live alheia (1 linha afetada),
-- fundador silencia, e usuario comum continua bloqueado (0 linhas).

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2; $$;

CREATE OR REPLACE FUNCTION public.is_super() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 3; $$;

COMMENT ON FUNCTION public.is_staff() IS
  'Fonte unica de "quem e staff" (admin, super_admin, owner). Existe porque 14 '
  'policies reescreviam a lista a mao e esqueciam o owner.';

REVOKE EXECUTE ON FUNCTION public.is_staff(), public.is_super() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(), public.is_super() TO authenticated;

-- ── posts: encerrar/editar post alheio ───────────────────────────────────────
DROP POLICY IF EXISTS posts_update ON public.posts;
CREATE POLICY posts_update ON public.posts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_staff());

-- ── silenciamento no chat de live ────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin e dono criam timeout" ON public.live_chat_timeouts;
CREATE POLICY "Admin e dono criam timeout" ON public.live_chat_timeouts FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR (SELECT auth.uid()) IN (SELECT user_id FROM posts WHERE id = post_id));
DROP POLICY IF EXISTS "Admin e dono atualizam timeout" ON public.live_chat_timeouts;
CREATE POLICY "Admin e dono atualizam timeout" ON public.live_chat_timeouts FOR UPDATE TO authenticated
  USING (public.is_staff() OR (SELECT auth.uid()) IN (SELECT user_id FROM posts WHERE id = post_id))
  WITH CHECK (public.is_staff() OR (SELECT auth.uid()) IN (SELECT user_id FROM posts WHERE id = post_id));
DROP POLICY IF EXISTS "Admin e dono deletam timeout" ON public.live_chat_timeouts;
CREATE POLICY "Admin e dono deletam timeout" ON public.live_chat_timeouts FOR DELETE TO authenticated
  USING (public.is_staff() OR (SELECT auth.uid()) IN (SELECT user_id FROM posts WHERE id = post_id));

DROP POLICY IF EXISTS "Admin e dono silenciam" ON public.live_muted;
CREATE POLICY "Admin e dono silenciam" ON public.live_muted FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR (SELECT auth.uid()) IN (SELECT user_id FROM posts WHERE id = post_id));
DROP POLICY IF EXISTS "Admin e dono removem silencio" ON public.live_muted;
CREATE POLICY "Admin e dono removem silencio" ON public.live_muted FOR DELETE TO authenticated
  USING (public.is_staff() OR (SELECT auth.uid()) IN (SELECT user_id FROM posts WHERE id = post_id));

-- ── keys e promos ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins inserem keys" ON public.game_keys;
CREATE POLICY "Admins inserem keys" ON public.game_keys FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Admins atualizam keys" ON public.game_keys;
CREATE POLICY "Admins atualizam keys" ON public.game_keys FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Admins deletam keys" ON public.game_keys;
CREATE POLICY "Admins deletam keys" ON public.game_keys FOR DELETE TO authenticated
  USING (public.is_staff());

-- ── midia do mural ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cpm_delete ON public.community_post_media;
CREATE POLICY cpm_delete ON public.community_post_media FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IN (SELECT user_id FROM community_posts WHERE id = post_id)
         OR public.is_staff());

-- ── pedidos de reativacao de live ────────────────────────────────────────────
DROP POLICY IF EXISTS admins_insert_requests ON public.live_reactivation_requests;
CREATE POLICY admins_insert_requests ON public.live_reactivation_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_staff()
              AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND banned));
DROP POLICY IF EXISTS select_own_or_superadmin_requests ON public.live_reactivation_requests;
CREATE POLICY select_own_or_superadmin_requests ON public.live_reactivation_requests FOR SELECT TO authenticated
  USING (admin_id = (SELECT auth.uid()) OR public.is_super());
DROP POLICY IF EXISTS superadmin_update_requests ON public.live_reactivation_requests;
CREATE POLICY superadmin_update_requests ON public.live_reactivation_requests FOR UPDATE TO authenticated
  USING (public.is_super());

-- ── perfis (o trigger-guarda continua protegendo as colunas privilegiadas) ───
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_staff());;
