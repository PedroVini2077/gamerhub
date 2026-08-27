CREATE OR REPLACE FUNCTION public.request_unban(
  p_user_id uuid,
  p_reason text
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
  v_existing_pending integer;
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

  -- Apenas admins (não super_admin) podem solicitar desbanimento
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Permissão negada: apenas admins podem solicitar desbanimento de usuários';
  END IF;

  -- Busca username do alvo
  SELECT username
    INTO v_target_username
    FROM public.profiles
   WHERE id = p_user_id;

  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado';
  END IF;

  -- Verifica se já existe solicitação pendente para esse usuário
  SELECT COUNT(*)
    INTO v_existing_pending
    FROM public.unban_requests
   WHERE target_user_id = p_user_id
     AND status = 'pending';

  IF v_existing_pending > 0 THEN
    RAISE EXCEPTION 'Já existe uma solicitação de desbanimento pendente para este usuário';
  END IF;

  -- Insere a solicitação
  INSERT INTO public.unban_requests (
    target_user_id, target_username,
    requesting_admin_id, requesting_admin_username,
    reason
  ) VALUES (
    p_user_id, v_target_username,
    v_caller_id, v_caller_username,
    p_reason
  );

  -- Log de auditoria
  INSERT INTO public.admin_logs (
    action, details, category, actor_id, actor_username,
    severity, metadata, admin_id, admin_username
  ) VALUES (
    'admin_unban_requested',
    v_caller_username || ' solicitou o desbanimento de ' || v_target_username || '. Motivo: ' || p_reason,
    'security',
    v_caller_id, v_caller_username,
    'info',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_username', v_target_username,
      'reason', p_reason
    ),
    v_caller_id, v_caller_username
  );

  -- Notificação para super_admins
  INSERT INTO public.admin_notifications (
    type, title, message, audience, metadata
  ) VALUES (
    'unban_request',
    'Solicitação de desbanimento',
    v_caller_username || ' solicitou o desbanimento do usuário ' || v_target_username || '. Motivo: ' || p_reason,
    'super_admin',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_username', v_target_username,
      'requesting_admin_id', v_caller_id,
      'requesting_admin_username', v_caller_username,
      'reason', p_reason
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_unban(uuid, text) TO authenticated;
;
