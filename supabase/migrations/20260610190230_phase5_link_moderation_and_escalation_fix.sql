-- 1. Adiciona 'links' como trigger_type válido
ALTER TABLE moderation_queue DROP CONSTRAINT moderation_queue_trigger_type_check;
ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY['report','wordlist','ai','escalation','links']));

-- 2. Suspensão automática pelo sistema (sem checar caller role)
CREATE OR REPLACE FUNCTION apply_mod_auto_suspend(p_user_id uuid, p_points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_username text; v_until timestamptz := now() + interval '7 days';
BEGIN
  -- Não suspende se já banido ou já suspenso
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND (banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))
  ) THEN RETURN; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_suspend',
    '@' || v_username || ' suspenso automaticamente pelo sistema (' || p_points || ' pontos)',
    'security', NULL, 'Sistema', 'warning',
    jsonb_build_object('target_id', p_user_id, 'points', p_points, 'until', v_until),
    NULL, 'Sistema');
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_suspend', 'Suspensão automática',
    '@' || v_username || ' foi suspenso automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins', jsonb_build_object('target_username', v_username, 'points', p_points));
END;
$$;

-- 3. Corrige escalação: usa mod_suspend_threshold antes do ban
CREATE OR REPLACE FUNCTION handle_violation_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total   int;
  v_ban_thr int;
  v_sus_thr int;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total FROM violations WHERE user_id = NEW.user_id;
  SELECT COALESCE(value::int, 15) INTO v_ban_thr FROM site_config WHERE key = 'mod_ban_threshold';
  SELECT COALESCE(value::int, 8)  INTO v_sus_thr FROM site_config WHERE key = 'mod_suspend_threshold';

  IF v_total >= v_ban_thr THEN
    PERFORM apply_mod_auto_ban(NEW.user_id, v_total);
  ELSIF v_total >= v_sus_thr THEN
    PERFORM apply_mod_auto_suspend(NEW.user_id, v_total);
  END IF;

  RETURN NEW;
END;
$$;

-- 4. RPC para moderação de links (Safe Browsing)
CREATE OR REPLACE FUNCTION apply_link_moderation(p_content_type text, p_content_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Respeita o toggle geral de moderação IA
  IF NOT EXISTS (SELECT 1 FROM site_config WHERE key = 'mod_ai_enabled' AND value = 'true') THEN
    RETURN;
  END IF;
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
    INSERT INTO moderation_queue (content_type, content_id, trigger_type)
    VALUES (p_content_type, p_content_id, 'links');
  END IF;
END;
$$;
;
