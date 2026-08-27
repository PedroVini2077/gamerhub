-- Fase 2: Moderação IA de texto via HuggingFace

ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

INSERT INTO site_config (key, value) VALUES
  ('mod_ai_enabled', 'false'),
  ('mod_ai_text_threshold', '0.7')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_ai_moderation(
  p_content_type text,
  p_content_id   uuid,
  p_score        float
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_enabled   boolean;
  v_threshold float;
BEGIN
  SELECT COALESCE(value::boolean, false) INTO v_enabled
  FROM site_config WHERE key = 'mod_ai_enabled';
  IF NOT v_enabled THEN RETURN; END IF;

  SELECT COALESCE(value::float, 0.7) INTO v_threshold
  FROM site_config WHERE key = 'mod_ai_text_threshold';
  IF p_score < v_threshold THEN RETURN; END IF;

  IF p_content_type = 'post' THEN
    UPDATE posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'comment' THEN
    UPDATE comments SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'mural' THEN
    UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai', jsonb_build_object('ai_score', p_score));
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, float) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, float) TO authenticated;;
