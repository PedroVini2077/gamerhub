CREATE OR REPLACE FUNCTION public.approve_unban_request(
  p_request_id uuid
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
  v_request public.unban_requests%ROWTYPE;
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

  -- Somente super_admin pode aprovar
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Permissão negada: apenas super_admins podem aprovar solicitações de desbanimento';
  END IF;

  -- Busca o request
  SELECT * INTO v_request
    FROM public.unban_requests
   WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Solicitação já foi processada (status: %)', v_request.status;
  END IF;

  -- Executa o unban no usuário alvo (lógica inline para funcionar como super_admin)
  UPDATE public.profiles
     SET banned = false,
         ban_reason = NULL,
         ban_details = NULL,
         banned_by = NULL,
         banned_by_username = NULL,
         banned_at = NULL
   WHERE id = v_request.target_user_id;

  -- Log do unban
  INSERT INTO public.admin_logs (
    action, details, category, actor_id, actor_username,
    severity, metadata, admin_id, admin_username
  ) VALUES (
    'admin_unban',
    'Usuário ' || v_request.target_username || ' foi desbanido via aprovação de solicitação.',
    'security',
    v_caller_id, v_caller_username,
    'info',
    jsonb_build_object(
      'target_user_id', v_request.target_user_id,
      'target_username', v_request.target_username,
      'request_id', p_request_id
    ),
    v_caller_id, v_caller_username
  );

  -- Atualiza o request
  UPDATE public.unban_requests
     SET status = 'approved',
         reviewed_by = v_caller_id,
         reviewed_by_username = v_caller_username,
         reviewed_at = now()
   WHERE id = p_request_id;

  -- Log de aprovação
  INSERT INTO public.admin_logs (
    action, details, category, actor_id, actor_username,
    severity, metadata, admin_id, admin_username
  ) VALUES (
    'admin_unban_approved',
    v_caller_username || ' aprovou a solicitação de desbanimento de ' || v_request.target_username,
    'security',
    v_caller_id, v_caller_username,
    'info',
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', v_request.target_user_id,
      'target_username', v_request.target_username,
      'requesting_admin_id', v_request.requesting_admin_id,
      'requesting_admin_username', v_request.requesting_admin_username
    ),
    v_caller_id, v_caller_username
  );

  -- Notificação para todos os admins
  INSERT INTO public.admin_notifications (
    type, title, message, audience, metadata
  ) VALUES (
    'unban_approved',
    'Desbanimento aprovado',
    v_caller_username || ' aprovou o desbanimento de ' || v_request.target_username
      || ' (solicitado por ' || v_request.requesting_admin_username || ')',
    'all_admins',
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', v_request.target_user_id,
      'target_username', v_request.target_username,
      'approved_by', v_caller_username,
      'requested_by', v_request.requesting_admin_username
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_unban_request(uuid) TO authenticated;
;
