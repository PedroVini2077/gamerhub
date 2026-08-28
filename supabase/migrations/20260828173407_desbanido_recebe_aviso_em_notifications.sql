-- Desbanir passa a AVISAR a pessoa.
--
-- O buraco que isto fecha, achado pelo dono testando em 28/08: a `BannedScreen`
-- simplesmente parava de aparecer. Do lado de quem foi desbanido, "meu recurso
-- foi aceito" e "o site parou de me bloquear por algum bug" eram exatamente a
-- mesma experiência — nenhum aviso, nenhuma explicação, nada.
--
-- Por que `notifications` e não realtime/email: a decisão pode sair enquanto a
-- pessoa não está online, então aviso ao vivo não chega. Estado guardado no
-- banco espera ela voltar, e o sino do `Header` já lê essa tabela — nenhuma
-- máquina nova para manter (§4).
--
-- Os dois caminhos precisam do INSERT, e é o erro clássico corrigir só um:
-- `unban_user` (o super admin desbane direto) e `approve_unban_request` (o
-- pedido de revisão é aceito) chegam ao mesmo estado por portas diferentes.

CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_caller_role     text;
  v_caller_username text;
  v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'owner') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = p_user_id;

  -- O aviso para a PESSOA. Sem isto o desbanimento é invisível para ela.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'unban',
    'Seu banimento foi revisto e removido. Sua conta voltou ao normal.'
      || COALESCE(' Nota da equipe: ' || p_note, ''));

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban',
    '@' || v_target_username || ' foi desbanido por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_unban_request(p_request_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_req unban_requests;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin','owner') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = v_req.target_user_id;

  UPDATE unban_requests
    SET status = 'approved', reviewed_by = v_caller_id,
        reviewed_by_username = v_caller_username, reviewed_at = now()
  WHERE id = p_request_id;

  -- Mesmo aviso do `unban_user`: quem recorreu precisa saber que ganhou o
  -- recurso, e a `BannedScreen` (onde ele acompanhava o caso) deixa de aparecer
  -- justamente por causa desta aprovação.
  INSERT INTO notifications (user_id, type, message)
  VALUES (v_req.target_user_id, 'unban',
    'Seu pedido de revisão foi aceito: o banimento foi removido e sua conta voltou ao normal.');

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
$function$;
