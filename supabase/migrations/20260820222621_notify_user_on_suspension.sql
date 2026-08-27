CREATE OR REPLACE FUNCTION public.apply_suspension(p_user_id uuid, p_days integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text; v_caller_username text; v_target_role text; v_target_username text;
  v_until timestamptz := now() + (p_days || ' days')::interval;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot suspend equal or higher role';
  END IF;

  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_suspended', '@' || v_target_username || ' suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'security', auth.uid(), v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'days', p_days, 'until', v_until), auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_suspended', 'Usuário suspenso',
    '@' || v_target_username || ' foi suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username, 'days', p_days));

  -- NOVO: avisa quem foi suspenso.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa por ' || p_days || ' dia(s). Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_mod_auto_suspend(p_user_id uuid, p_points integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_username text; v_until timestamptz := now() + interval '7 days';
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id
             AND (banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))) THEN
    RETURN;
  END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_suspend', '@' || v_username || ' suspenso automaticamente pelo sistema (' || p_points || ' pontos)',
    'security', NULL, 'Sistema', 'warning',
    jsonb_build_object('target_id', p_user_id, 'points', p_points, 'until', v_until), NULL, 'Sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_suspend', 'Suspensão automática',
    '@' || v_username || ' foi suspenso automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins', jsonb_build_object('target_username', v_username, 'points', p_points));

  -- NOVO: avisa quem foi suspenso. Sem isso a suspensão automática era
  -- completamente invisível pra quem levou.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa automaticamente por acúmulo de infrações. Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$function$;;
