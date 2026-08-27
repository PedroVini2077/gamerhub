-- Por que esta migracao existe
--
-- A moderacao de imagem vai passar a cobrir violencia e automutilacao, alem de
-- pornografia. Mas num site de JOGOS a maioria das imagens e print de jogo, e
-- NENHUM modelo distingue gore de Doom de gore real.
--
-- A saida nao e o modelo, e o destino da nota: `violence/graphic` precisa
-- ENFILEIRAR para uma pessoa olhar, e nunca ocultar sozinho. Assim um limiar
-- errado gera fila maior — nunca censura de conteudo legitimo.
--
-- Ate agora a RPC so sabia fazer as duas coisas juntas. Ganha `p_ocultar`.
CREATE OR REPLACE FUNCTION public.apply_ai_moderation(
  p_content_type text, p_content_id uuid, p_score double precision,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold',
  p_categoria text DEFAULT NULL,
  p_ocultar boolean DEFAULT true
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

  IF p_ocultar THEN
    IF p_content_type = 'post' THEN
      UPDATE posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
    ELSIF p_content_type = 'comment' THEN
      UPDATE comments SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
    ELSIF p_content_type = 'mural' THEN
      UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
    END IF;
    v_ocultou := FOUND AND p_content_type IN ('post','comment','mural');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai',
            jsonb_build_object('ai_score', p_score, 'categoria', p_categoria,
                               'ocultou', v_ocultou));

    -- A trilha precisa distinguir "ocultou" de "so mandou revisar", senao o
    -- log mente sobre o que aconteceu.
    INSERT INTO admin_logs (action, details, category, severity,
                            admin_id, admin_username, actor_id, actor_username, metadata)
    VALUES ('ai_moderation_hidden',
            format('IA %s %s por %s (score %s)',
                   CASE WHEN v_ocultou THEN 'ocultou' ELSE 'enviou para revisão' END,
                   p_content_type, motivo_legivel(p_categoria), round(p_score::numeric, 3)),
            'moderation', CASE WHEN v_ocultou THEN 'warning' ELSE 'info' END,
            NULL, 'sistema', NULL, 'sistema',
            jsonb_build_object('content_type', p_content_type, 'content_id', p_content_id,
                               'ai_score', p_score, 'categoria', p_categoria,
                               'ocultou', v_ocultou));
  END IF;

  -- So avisa quem teve conteudo REALMENTE ocultado. Mandar "seu post foi
  -- ocultado" para quem so entrou na fila seria mentira.
  IF v_ocultou THEN
    PERFORM avisar_autor_do_ocultamento(p_content_type, p_content_id, p_categoria);
  END IF;
END;
$fn$;

DROP FUNCTION IF EXISTS public.apply_ai_moderation(text, uuid, double precision, text, text);

REVOKE ALL ON FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text, boolean) TO service_role;;
