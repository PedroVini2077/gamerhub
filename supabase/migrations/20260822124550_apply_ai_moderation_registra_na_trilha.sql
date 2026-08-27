-- A IA ocultava conteudo sem deixar rastro na trilha de auditoria.
--
-- `apply_ai_moderation` preenchia `hidden_at` e enfileirava em
-- `moderation_queue`, mas nao gravava NADA em `admin_logs`. Se um usuario
-- reclamasse "meu post sumiu", o admin olharia os logs e nao acharia nada —
-- so encontraria se soubesse procurar direto na fila de moderacao.
--
-- Ficou mais grave agora que a IA foi trocada pela OpenAI e passou a ocultar
-- de verdade (antes era cega pra conteudo sexual e quase nada era ocultado).
--
-- A funcao e SECURITY DEFINER e roda como dona da tabela, entao o INSERT passa
-- pela RLS normalmente. `admin_id`/`actor_id` ficam NULL porque nao existe
-- pessoa por tras da acao — o autor e o sistema, e `admin_username` (NOT NULL)
-- registra isso explicitamente.
--
-- Testado em ROLLBACK, 4 casos: acima do limiar grava o log, o texto sai
-- formatado com o score, score abaixo do limiar nao gera log, e a fila de
-- moderacao continua sendo criada.

CREATE OR REPLACE FUNCTION public.apply_ai_moderation(
  p_content_type text, p_content_id uuid, p_score double precision,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_enabled boolean; v_threshold float;
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

  -- O log vai junto da entrada na fila: so registra quando a acao de fato
  -- aconteceu, e nao repete se o conteudo ja estava pendente de revisao.
  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai', jsonb_build_object('ai_score', p_score));

    INSERT INTO admin_logs (action, details, category, severity,
                            admin_id, admin_username, actor_id, actor_username, metadata)
    VALUES ('ai_moderation_hidden',
            format('IA ocultou %s (score %s)', p_content_type, round(p_score::numeric, 3)),
            'moderation', 'warning', NULL, 'sistema', NULL, 'sistema',
            jsonb_build_object('content_type', p_content_type,
                               'content_id', p_content_id, 'ai_score', p_score));
  END IF;
END;
$fn$;;
