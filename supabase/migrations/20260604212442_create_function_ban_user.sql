CREATE OR REPLACE FUNCTION public.ban_user(
  p_user_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_username text;
  v_target_role text;
  v_target_username text;
  v_role_rank integer;
  v_target_rank integer;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Busca role e username do chamador
  SELECT role, username
    INTO v_caller_role, v_caller_username
    FROM public.profiles
   WHERE id = v_caller_id;

  -- Verifica se é admin ou super_admin
  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permissão negada: apenas admins podem banir usuários';
  END IF;

  -- Busca role e username do alvo
  SELECT role, username
    INTO v_target_role, v_target_username
    FROM public.profiles
   WHERE id = p_user_id;

  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado';
  END IF;

  -- Hierarquia: user=1, admin=2, super_admin=3
  v_role_rank := CASE v_caller_role
    WHEN 'user' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'super_admin' THEN 3
    ELSE 0
  END;

  v_target_rank := CASE v_target_role
    WHEN 'user' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'super_admin' THEN 3
    ELSE 1
  END;

  -- Não pode banir alguém com role igual ou superior
  IF v_target_rank >= v_role_rank THEN
    RAISE EXCEPTION 'Permissão negada: você não pode banir um usuário com role igual ou superior ao seu';
  END IF;

  -- Aplica o ban
  UPDATE public.profiles
     SET banned = true,
         ban_reason = p_reason,
         ban_details = p_details,
         banned_by = v_caller_id,
         banned_by_username = v_caller_username,
         banned_at = now()
   WHERE id = p_user_id;

  -- Log de auditoria
  INSERT INTO public.admin_logs (
    action, details, category, actor_id, actor_username,
    severity, metadata, admin_id, admin_username
  ) VALUES (
    'admin_ban',
    'Usuário ' || v_target_username || ' foi banido. Motivo: ' || p_reason,
    'security',
    v_caller_id, v_caller_username,
    'warning',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_username', v_target_username,
      'ban_reason', p_reason,
      'ban_details', p_details
    ),
    v_caller_id, v_caller_username
  );

  -- Notificação para admins
  INSERT INTO public.admin_notifications (
    type, title, message, audience, metadata
  ) VALUES (
    'user_banned',
    'Usuário banido',
    v_caller_username || ' baniu o usuário ' || v_target_username || '. Motivo: ' || p_reason,
    'all_admins',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_username', v_target_username,
      'banned_by', v_caller_username,
      'ban_reason', p_reason
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ban_user(uuid, text, text) TO authenticated;
;
