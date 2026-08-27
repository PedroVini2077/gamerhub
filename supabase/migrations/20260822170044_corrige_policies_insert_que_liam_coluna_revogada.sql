-- CRIACAO DE CONTEUDO ESTAVA TOTALMENTE QUEBRADA NO SITE.
--
-- Sintoma relatado pelo dono: "criar post, qualquer tipo, da erro na tabela
-- profile" e "nao consigo postar lives". Reproduzido assumindo o papel dele:
--
--   INSERT INTO posts ... -> ERRO: permission denied for table profiles
--
-- Causa raiz: as policies de INSERT de `posts`, `comments`, `community_posts` e
-- `live_chat` checavam suspensao com uma subconsulta direta:
--
--   NOT (auth.uid() IN (SELECT id FROM profiles
--                        WHERE banned = true
--                           OR (suspended_until IS NOT NULL AND suspended_until > now())))
--
-- Essa subconsulta le `profiles.suspended_until`, e `authenticated` NAO tem
-- privilegio de SELECT nessa coluna — ela foi revogada junto com as outras
-- colunas sensiveis (birth_date, ban_reason, ban_details...) na auditoria de
-- LGPD/seguranca. O Postgres reporta falta de privilegio de COLUNA como
-- "permission denied for table", o que despistou o diagnostico.
--
-- Ou seja: um endurecimento de seguranca legitimo derrubou, em silencio, a
-- funcionalidade central do site — postar, comentar, usar o mural e o chat de
-- live. Ninguem percebeu porque nenhum teste alcanca caminho autenticado.
-- A tabela `posts` esta vazia, o que bate com o diagnostico.
--
-- CORRECAO: a checagem passa por uma funcao SECURITY DEFINER, mesmo padrao que
-- o projeto ja usa em `can_moderate_content`. A funcao le a coluna com o
-- privilegio do dono; quem chama nao precisa enxergar `suspended_until`.
--
-- Testado em ROLLBACK antes de aplicar:
--   post/comentario/mural/chat/live voltam a funcionar
--   postar em nome de outro usuario continua bloqueado
--   banido continua bloqueado
--   suspenso continua bloqueado
--   suspensao expirada volta a poder postar
--   anon nao executa a funcao

CREATE OR REPLACE FUNCTION public.pode_publicar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = (SELECT auth.uid())
       AND (banned = true
            OR (suspended_until IS NOT NULL AND suspended_until > now()))
  );
$$;

COMMENT ON FUNCTION public.pode_publicar() IS
  'Diz se quem chama pode criar conteudo (nao banido, nao suspenso). '
  'E SECURITY DEFINER porque le profiles.suspended_until, coluna revogada de '
  'authenticated — usar a subconsulta direta numa policy quebra o INSERT com '
  '"permission denied for table profiles".';

REVOKE EXECUTE ON FUNCTION public.pode_publicar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_publicar() TO authenticated;

DROP POLICY IF EXISTS posts_insert ON public.posts;
CREATE POLICY posts_insert ON public.posts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.pode_publicar());

DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.pode_publicar());

DROP POLICY IF EXISTS community_posts_insert ON public.community_posts;
CREATE POLICY community_posts_insert ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.pode_publicar());

DROP POLICY IF EXISTS live_chat_insert ON public.live_chat;
CREATE POLICY live_chat_insert ON public.live_chat FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND public.pode_publicar());;
