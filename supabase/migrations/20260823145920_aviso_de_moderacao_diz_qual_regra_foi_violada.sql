-- Por que esta migracao existe
--
-- "Seu post foi ocultado por violar as regras da comunidade" nao ensina nada.
-- Quem recebe nao sabe o que evitar, e a reacao natural e achar que foi
-- perseguicao. Dizer "por assedio" ou "por linguagem ofensiva" educa.
--
-- A categoria vem da IA (a Edge Function ja calcula qual passou do limiar) ou
-- do tipo de gatilho. O mapa para portugues fica AQUI, no banco, e nao no
-- TypeScript: assim todo texto que o usuario le sobre moderacao mora num lugar
-- so. Duas copias divergiriam (§4, fonte unica).

CREATE OR REPLACE FUNCTION public.motivo_legivel(p_categoria text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  -- Mapa explicito. Categoria desconhecida NAO vira um palpite: cai num texto
  -- generico que continua sendo verdade (§4, proibido fallback silencioso).
  SELECT CASE p_categoria
    WHEN 'wordlist'               THEN 'conter linguagem ofensiva'
    WHEN 'harassment'             THEN 'assédio a outra pessoa'
    WHEN 'harassment/threatening' THEN 'ameaça a outra pessoa'
    WHEN 'hate'                   THEN 'discurso de ódio'
    WHEN 'hate/threatening'       THEN 'discurso de ódio com ameaça'
    WHEN 'sexual'                 THEN 'conteúdo sexual'
    WHEN 'sexual/minors'          THEN 'conteúdo sexual envolvendo menores'
    WHEN 'self-harm'              THEN 'conteúdo sobre automutilação'
    WHEN 'self-harm/intent'       THEN 'conteúdo sobre automutilação'
    WHEN 'self-harm/instructions' THEN 'conteúdo sobre automutilação'
    WHEN 'violence'               THEN 'violência'
    WHEN 'violence/graphic'       THEN 'violência explícita'
    WHEN 'illicit'                THEN 'incentivo a atividade ilícita'
    WHEN 'illicit/violent'        THEN 'incentivo a atividade ilícita violenta'
    WHEN 'nsfw'                   THEN 'imagem imprópria'
    ELSE 'suspeita de violação das regras da comunidade'
  END;
$fn$;

DROP FUNCTION IF EXISTS public.avisar_autor_do_ocultamento(text, uuid, text);

CREATE FUNCTION public.avisar_autor_do_ocultamento(
  p_content_type text, p_content_id uuid, p_categoria text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_autor uuid; v_rotulo text;
BEGIN
  IF    p_content_type = 'post'    THEN
    SELECT user_id INTO v_autor FROM posts WHERE id = p_content_id;
    v_rotulo := 'Seu post';
  ELSIF p_content_type = 'comment' THEN
    SELECT user_id INTO v_autor FROM comments WHERE id = p_content_id;
    v_rotulo := 'Seu comentário';
  ELSIF p_content_type = 'mural'   THEN
    SELECT user_id INTO v_autor FROM community_posts WHERE id = p_content_id;
    v_rotulo := 'Sua mensagem no mural';
  ELSE
    RETURN;
  END IF;

  IF v_autor IS NULL THEN RETURN; END IF;

  INSERT INTO notifications (user_id, type, message)
  VALUES (v_autor, 'moderation',
    v_rotulo || ' foi ocultado automaticamente por ' || motivo_legivel(p_categoria) ||
    '. A equipe vai revisar — se for engano, ele volta ao ar.');
END;
$fn$;

REVOKE ALL ON FUNCTION public.avisar_autor_do_ocultamento(text, uuid, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.apply_ai_moderation(text, uuid, double precision, text);

CREATE FUNCTION public.apply_ai_moderation(
  p_content_type text, p_content_id uuid, p_score double precision,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold',
  p_categoria text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_enabled boolean; v_threshold float; v_ocultou boolean := false;
BEGIN
  SELECT COALESCE(value::boolean, false) INTO v_enabled FROM site_config WHERE key = 'mod_ai_enabled';
  IF NOT v_enabled THEN RETURN; END IF;
  SELECT COALESCE(value::float, 0.7) INTO v_threshold FROM site_config WHERE key = p_threshold_key;
  IF p_score < v_threshold THEN RETURN; END IF;

  IF p_content_type = 'post' THEN
    UPDATE posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'comment' THEN
    UPDATE comments SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'mural' THEN
    UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  END IF;
  v_ocultou := FOUND AND p_content_type IN ('post','comment','mural');

  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai',
            jsonb_build_object('ai_score', p_score, 'categoria', p_categoria));

    INSERT INTO admin_logs (action, details, category, severity,
                            admin_id, admin_username, actor_id, actor_username, metadata)
    VALUES ('ai_moderation_hidden',
            format('IA ocultou %s por %s (score %s)', p_content_type,
                   motivo_legivel(p_categoria), round(p_score::numeric, 3)),
            'moderation', 'warning', NULL, 'sistema', NULL, 'sistema',
            jsonb_build_object('content_type', p_content_type, 'content_id', p_content_id,
                               'ai_score', p_score, 'categoria', p_categoria));
  END IF;

  IF v_ocultou THEN
    PERFORM avisar_autor_do_ocultamento(p_content_type, p_content_id, p_categoria);
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text) TO service_role;;
