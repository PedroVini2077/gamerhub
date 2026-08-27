-- Contador de reincidência
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;

  IF role_rank(v_caller_role) <= 1 THEN
    RAISE EXCEPTION 'Access denied: admin required';
  END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot ban equal or higher role';
  END IF;

  -- Bane o perfil e incrementa a reincidência
  UPDATE profiles
    SET banned = true, ban_reason = p_reason, ban_details = p_details,
        banned_by = v_caller_id, banned_by_username = v_caller_username,
        banned_at = now(), ban_count = ban_count + 1
  WHERE id = p_user_id;

  -- Remove TODA a atividade do usuário banido
  DELETE FROM posts           WHERE user_id = p_user_id;
  DELETE FROM comments        WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat       WHERE user_id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_ban',
    '@' || v_target_username || ' foi banido por @' || v_caller_username || '. Motivo: ' || p_reason ||
      COALESCE(' — ' || p_details, ''),
    'security', v_caller_id, v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username,
      'reason', p_reason, 'details', p_details),
    v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_banned', 'Usuário banido',
    '@' || v_target_username || ' foi banido por @' || v_caller_username || '. Motivo: ' || p_reason,
    'all_admins',
    jsonb_build_object('target_username', v_target_username, 'reason', p_reason));
END;
$f$;

-- Registra (log + notificação) quando uma conta banida tenta logar.
-- SECURITY DEFINER + grant anon: o usuário é deslogado antes de chamar.
CREATE OR REPLACE FUNCTION public.record_banned_login_attempt(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_email text := lower(trim(p_email));
  v_username text;
BEGIN
  SELECT p.username INTO v_username
    FROM auth.users au JOIN public.profiles p ON p.id = au.id
   WHERE au.email = v_email;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auth_banned_attempt',
    'Conta banida tentou fazer login: ' || COALESCE('@' || v_username, v_email),
    'security', NULL, 'sistema', 'warning',
    jsonb_build_object('email', v_email, 'username', v_username),
    NULL, 'sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('banned_login_attempt', 'Tentativa de acesso de banido',
    'Uma conta banida' || COALESCE(' (@' || v_username || ')', '') || ' tentou fazer login.',
    'all_admins',
    jsonb_build_object('email', v_email, 'username', v_username));
END;
$f$;
GRANT EXECUTE ON FUNCTION public.record_banned_login_attempt TO anon, authenticated;;
