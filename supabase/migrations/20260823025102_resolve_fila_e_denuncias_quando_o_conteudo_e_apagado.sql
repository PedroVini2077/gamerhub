-- Por que esta migracao existe
--
-- O dono baniu um usuario pela fila. `ban_user` faz `DELETE FROM posts WHERE
-- user_id = ...` (e o mesmo para comentarios e mural), mas nunca toca em
-- `moderation_queue`. Resultado: os itens daquele usuario ficaram `pending`
-- para sempre, apontando para linhas que nao existem mais, mostrando
-- "Conteudo nao existe mais" e sem jeito de sair da fila.
--
-- Correcao de CLASSE, nao de caso: o problema nao e do `ban_user`, e de
-- QUALQUER caminho que apague conteudo — o proprio autor apagando o post, o
-- admin apagando, exclusao de conta, cascade de FK. Um trigger AFTER DELETE
-- em cada tabela de conteudo cobre todos de uma vez, inclusive os que ainda
-- nao existem.
--
-- `moderation_queue` e `reports` nao tem FK para o conteudo (o `content_id`
-- aponta para quatro tabelas diferentes, entao FK nao e possivel) — por isso
-- nada limpava sozinho.
--
-- Os dois indices `(content_type, content_id)` ja existem nas duas tabelas,
-- entao o trigger nao vira varredura ao apagar muita coisa de uma vez.

CREATE OR REPLACE FUNCTION public.resolver_moderacao_de_conteudo_apagado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_tipo text;
BEGIN
  v_tipo := CASE TG_TABLE_NAME
              WHEN 'posts'           THEN 'post'
              WHEN 'comments'        THEN 'comment'
              WHEN 'community_posts' THEN 'mural'
              ELSE                        'chat'
            END;

  -- `approved` e o desfecho correto: o conteudo nao existe mais, que e o
  -- resultado mais forte que a moderacao poderia ter alcancado. Fica marcado
  -- na metadata que quem resolveu foi o sistema, nao uma pessoa.
  UPDATE moderation_queue
     SET status      = 'approved',
         reviewed_at = now(),
         metadata    = coalesce(metadata, '{}'::jsonb)
                       || jsonb_build_object('resolvido_automaticamente', 'conteudo_apagado')
   WHERE content_type = v_tipo AND content_id = OLD.id AND status = 'pending';

  UPDATE reports
     SET status = 'reviewed'
   WHERE content_type = v_tipo AND content_id = OLD.id AND status = 'pending';

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_resolver_moderacao_apagado ON public.posts;
DROP TRIGGER IF EXISTS trg_resolver_moderacao_apagado ON public.comments;
DROP TRIGGER IF EXISTS trg_resolver_moderacao_apagado ON public.community_posts;
DROP TRIGGER IF EXISTS trg_resolver_moderacao_apagado ON public.live_chat;

CREATE TRIGGER trg_resolver_moderacao_apagado AFTER DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.resolver_moderacao_de_conteudo_apagado();
CREATE TRIGGER trg_resolver_moderacao_apagado AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.resolver_moderacao_de_conteudo_apagado();
CREATE TRIGGER trg_resolver_moderacao_apagado AFTER DELETE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.resolver_moderacao_de_conteudo_apagado();
CREATE TRIGGER trg_resolver_moderacao_apagado AFTER DELETE ON public.live_chat
  FOR EACH ROW EXECUTE FUNCTION public.resolver_moderacao_de_conteudo_apagado();

-- Limpeza dos que ja estavam presos. Dimensionado antes: 2 itens (1 post,
-- 1 comentario) e 0 denuncias.
UPDATE moderation_queue q
   SET status      = 'approved',
       reviewed_at = now(),
       metadata    = coalesce(metadata, '{}'::jsonb)
                     || jsonb_build_object('resolvido_automaticamente', 'conteudo_apagado')
 WHERE q.status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM posts           p WHERE q.content_type='post'    AND p.id = q.content_id)
   AND NOT EXISTS (SELECT 1 FROM comments        c WHERE q.content_type='comment' AND c.id = q.content_id)
   AND NOT EXISTS (SELECT 1 FROM community_posts m WHERE q.content_type='mural'   AND m.id = q.content_id)
   AND NOT EXISTS (SELECT 1 FROM live_chat       l WHERE q.content_type='chat'    AND l.id = q.content_id);

UPDATE reports r
   SET status = 'reviewed'
 WHERE r.status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM posts           p WHERE r.content_type='post'    AND p.id = r.content_id)
   AND NOT EXISTS (SELECT 1 FROM comments        c WHERE r.content_type='comment' AND c.id = r.content_id)
   AND NOT EXISTS (SELECT 1 FROM community_posts m WHERE r.content_type='mural'   AND m.id = r.content_id)
   AND NOT EXISTS (SELECT 1 FROM live_chat       l WHERE r.content_type='chat'    AND l.id = r.content_id);;
