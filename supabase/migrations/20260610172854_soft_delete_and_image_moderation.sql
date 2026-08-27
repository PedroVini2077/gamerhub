ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

DROP POLICY IF EXISTS posts_select ON posts;
CREATE POLICY posts_select ON posts FOR SELECT USING (
  (deleted_at IS NULL  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2)
  AND
  (hidden_at  IS NULL  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2)
);

CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_owner uuid; v_rank int;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  SELECT role_rank(role) INTO v_rank FROM profiles WHERE id = (SELECT auth.uid());
  IF (SELECT auth.uid()) <> v_owner AND v_rank < 2 THEN
    RAISE EXCEPTION 'Sem permissão para excluir este post';
  END IF;
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id AND deleted_at IS NULL;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.soft_delete_post(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_post(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_post(p_post_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_rank int;
BEGIN
  SELECT role_rank(role) INTO v_rank FROM profiles WHERE id = (SELECT auth.uid());
  IF v_rank < 2 THEN RAISE EXCEPTION 'Apenas admins podem restaurar posts'; END IF;
  UPDATE posts SET deleted_at = null WHERE id = p_post_id;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.restore_post(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.restore_post(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_mod_auto_ban(p_user_id uuid, p_points int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_username text;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN RETURN; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET
    banned             = true,
    ban_reason         = 'Banimento automático — limite de infrações atingido (' || p_points || ' pontos)',
    banned_by_username = 'Sistema',
    banned_at          = now(),
    ban_count          = ban_count + 1
  WHERE id = p_user_id;
  UPDATE posts SET deleted_at = now() WHERE user_id = p_user_id AND deleted_at IS NULL;
  DELETE FROM comments        WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat       WHERE user_id = p_user_id;
  INSERT INTO admin_logs
    (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES (
    'auto_ban',
    '@' || v_username || ' banido automaticamente pelo sistema (' || p_points || ' pontos de infrações)',
    'security', NULL, 'Sistema', 'critical',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_username, 'points', p_points),
    NULL, 'Sistema'
  );
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES (
    'auto_ban', 'Banimento automático',
    '@' || v_username || ' foi banido automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins',
    jsonb_build_object('target_username', v_username, 'points', p_points)
  );
END;
$fn$;

DROP FUNCTION IF EXISTS public.apply_ai_moderation(text, uuid, float);
CREATE FUNCTION public.apply_ai_moderation(
  p_content_type  text,
  p_content_id    uuid,
  p_score         float,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
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
  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai', jsonb_build_object('ai_score', p_score));
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, float, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, float, text) TO authenticated;

INSERT INTO site_config (key, value) VALUES ('mod_ai_image_threshold', '0.85')
ON CONFLICT (key) DO NOTHING;;
