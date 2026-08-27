-- Hierarquia de roles para validar permissões
CREATE OR REPLACE FUNCTION public.role_rank(r text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE r WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 WHEN 'user' THEN 1 ELSE 0 END;
$$;

-- Banir usuário
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

  UPDATE profiles
    SET banned = true, ban_reason = p_reason, ban_details = p_details,
        banned_by = v_caller_id, banned_by_username = v_caller_username, banned_at = now()
  WHERE id = p_user_id;

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
GRANT EXECUTE ON FUNCTION public.ban_user TO authenticated;

-- Desbanir usuário (super_admin only)
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban',
    '@' || v_target_username || ' foi desbanido por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$f$;
GRANT EXECUTE ON FUNCTION public.unban_user TO authenticated;

-- Solicitar desbanimento (admin → super_admin)
CREATE OR REPLACE FUNCTION public.request_unban(p_user_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('admin') THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN
    RAISE EXCEPTION 'User is not banned';
  END IF;
  IF EXISTS (SELECT 1 FROM unban_requests WHERE target_user_id = p_user_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Already has a pending request';
  END IF;

  INSERT INTO unban_requests (target_user_id, target_username, requesting_admin_id, requesting_admin_username, reason)
  VALUES (p_user_id, v_target_username, v_caller_id, v_caller_username, p_reason);

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_requested',
    'Admin @' || v_caller_username || ' solicitou desbanimento de @' || v_target_username ||
      '. Motivo: ' || p_reason,
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_target_username, 'reason', p_reason),
    v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_request', 'Solicitação de desbanimento',
    'Admin @' || v_caller_username || ' pediu o desbanimento de @' || v_target_username,
    'super_admin',
    jsonb_build_object('target_username', v_target_username, 'admin_username', v_caller_username));
END;
$f$;
GRANT EXECUTE ON FUNCTION public.request_unban TO authenticated;

-- Aprovar solicitação de desbanimento
CREATE OR REPLACE FUNCTION public.approve_unban_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_req unban_requests;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  -- Desbane
  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = v_req.target_user_id;

  UPDATE unban_requests
    SET status = 'approved', reviewed_by = v_caller_id,
        reviewed_by_username = v_caller_username, reviewed_at = now()
  WHERE id = p_request_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_approved',
    'Super admin @' || v_caller_username || ' aprovou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')',
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username,
      'requesting_admin', v_req.requesting_admin_username),
    v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_approved', 'Desbanimento aprovado',
    '@' || v_req.target_username || ' foi desbanido pelo super admin.',
    'all_admins',
    jsonb_build_object('target_username', v_req.target_username));
END;
$f$;
GRANT EXECUTE ON FUNCTION public.approve_unban_request TO authenticated;

-- Negar solicitação de desbanimento
CREATE OR REPLACE FUNCTION public.deny_unban_request(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_req unban_requests;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  UPDATE unban_requests
    SET status = 'denied', reviewed_by = v_caller_id,
        reviewed_by_username = v_caller_username, reviewed_at = now(), review_note = p_note
  WHERE id = p_request_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_denied',
    'Super admin @' || v_caller_username || ' negou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')' ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$f$;
GRANT EXECUTE ON FUNCTION public.deny_unban_request TO authenticated;;
