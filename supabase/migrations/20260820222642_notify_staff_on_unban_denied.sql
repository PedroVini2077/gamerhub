CREATE OR REPLACE FUNCTION public.deny_unban_request(p_request_id uuid, p_note text DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text; v_req unban_requests;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin','owner') THEN RAISE EXCEPTION 'Access denied: super_admin required'; END IF;
  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  UPDATE unban_requests SET status = 'denied', reviewed_by = v_caller_id,
    reviewed_by_username = v_caller_username, reviewed_at = now(), review_note = p_note
  WHERE id = p_request_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_denied',
    'Super admin @' || v_caller_username || ' negou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')' || COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username, 'note', p_note), v_caller_id, v_caller_username);

  -- NOVO: espelha o comportamento da aprovação.
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_denied', 'Desbanimento negado',
    'O pedido de desbanimento de @' || v_req.target_username || ' (feito por @' ||
      v_req.requesting_admin_username || ') foi negado por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'all_admins', jsonb_build_object('target_username', v_req.target_username,
                                     'requesting_admin', v_req.requesting_admin_username,
                                     'note', p_note));
END;
$function$;;
