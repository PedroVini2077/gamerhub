CREATE OR REPLACE FUNCTION public.unban_user(
  p_user_id uuid,
  p_note text DEFAULT NULL
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
  v_target_username text;
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

  -- Somente super_admin pode desbanir diretamente
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Permissão negada: apenas super_admins podem desbanir usuários diretamente';
  END IF;

  -- Busca username do alvo
  SELECT username
    INTO v_target_username
    FROM public.profiles
   WHERE id = p_user_id;

  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado';
  END IF;

  -- Remove o ban
  UPDATE public.profiles
     SET banned = false,
         ban_reason = NULL,
         ban_details = NULL,
         banned_by = NULL,
         banned_by_username = NULL,
         banned_at = NULL
   WHERE id = p_user_id;

  -- Log de auditoria
  INSERT INTO public.admin_logs (
    action, details, category, actor_id, actor_username,
    severity, metadata, admin_id, admin_username
  ) VALUES (
    'admin_unban',
    'Usuário ' || v_target_username || ' foi desbanido.' || COALESCE(' Nota: ' || p_note, ''),
    'security',
    v_caller_id, v_caller_username,
    'info',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_username', v_target_username,
      'note', p_note
    ),
    v_caller_id, v_caller_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unban_user(uuid, text) TO authenticated;
;
