-- `[18/09]` Dois 🔵 da fila, e os dois sao da mesma familia: **acao que passa
-- sem fazer nada**, ou que faz e nao avisa ninguem.

-- ── 1. `restore_post` restaurava post que NAO estava apagado ────────────────
--
-- O `UPDATE posts SET deleted_at = null WHERE id = p_post_id` nao conferia o
-- estado. Restaurar algo ja restaurado afetava 1 linha, nao mudava nada, e a
-- tela dizia "restaurado".
--
-- Nao e brecha — quem chama ja passou pelo guard de rank e hierarquia. E a
-- fonte de silencio nº 2 do §1.5 pelo lado inverso: 1 linha afetada e ZERO
-- efeito, que e indistinguivel de sucesso.
--
-- Provado em ROLLBACK com papel de `owner` real:
--   antes  -> a 2a chamada ACEITOU (efeito nulo, sem erro)
--   depois -> a 2a chamada recusa com mensagem que explica
--   e o caminho feliz (post de verdade apagado) CONTINUA restaurando
--
-- A guarda e dupla de proposito: o `RAISE` avisa quem chamou, e o
-- `AND deleted_at IS NOT NULL` no UPDATE fecha a corrida entre o SELECT e o
-- UPDATE — dois admins clicando junto.

CREATE OR REPLACE FUNCTION public.restore_post(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_owner uuid; v_apagado timestamptz;
BEGIN
  SELECT user_id, deleted_at INTO v_owner, v_apagado FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Apenas admins podem restaurar posts';
  END IF;
  IF (SELECT auth.uid()) <> v_owner AND NOT can_moderate_content(v_owner) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este post';
  END IF;
  IF v_apagado IS NULL THEN
    RAISE EXCEPTION 'Este post não está apagado — não há o que restaurar.';
  END IF;
  UPDATE posts SET deleted_at = null WHERE id = p_post_id AND deleted_at IS NOT NULL;
END;
$fn$;

-- ── 2. `deny_unban_request` nao avisava a PESSOA ───────────────────────────
--
-- A aprovacao insere em `notifications` ("seu pedido foi aceito"); a negativa
-- gravava em `admin_logs` e `admin_notifications` — ou seja, **so a equipe
-- ficava sabendo**. Quem recorreu do proprio banimento ficava sem resposta.
--
-- A `BannedScreen` mostra o estado do pedido, entao ele nao sumia de vez. Mas a
-- assimetria e do tipo que ninguem percebe de dentro: o caminho de aceitar foi
-- escrito com cuidado, e o de negar parou no meio.
--
-- O texto diz o que a pessoa precisa saber e NAO promete o que nao vai
-- acontecer (mesma regra da SEC-021): o banimento continua, e a nota da equipe
-- vai junto quando existir.

CREATE OR REPLACE FUNCTION public.deny_unban_request(p_request_id uuid, p_note text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_caller_id uuid := auth.uid(); v_caller_username text; v_req unban_requests;
BEGIN
  IF NOT is_super() THEN RAISE EXCEPTION 'Access denied: super_admin required'; END IF;
  SELECT username INTO v_caller_username FROM profiles WHERE id = v_caller_id;

  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  IF p_note IS NOT NULL AND length(p_note) > 500 THEN
    RAISE EXCEPTION 'A nota da equipe deve ter no maximo 500 caracteres.';
  END IF;

  UPDATE unban_requests SET status = 'denied', reviewed_by = v_caller_id,
    reviewed_by_username = v_caller_username, reviewed_at = now(), review_note = p_note
  WHERE id = p_request_id;

  -- `[18/09]` A PESSOA passa a ser avisada. Espelha o `approve_unban_request`,
  -- que sempre fez isso. `target_user_id` pode ser nulo em pedido antigo, e
  -- notificar ninguem estouraria a funcao inteira — por isso o IF.
  IF v_req.target_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, message)
    VALUES (v_req.target_user_id, 'unban',
      'Seu pedido de revisão foi analisado e NÃO foi aceito: o banimento continua.'
        || COALESCE(' Nota da equipe: ' || p_note, ''));
  END IF;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_denied',
    'Super admin @' || v_caller_username || ' negou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')' || COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username, 'note', p_note), v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_denied', 'Desbanimento negado',
    'O pedido de desbanimento de @' || v_req.target_username || ' (feito por @' ||
      v_req.requesting_admin_username || ') foi negado por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'all_admins', jsonb_build_object('target_username', v_req.target_username,
                                     'requesting_admin', v_req.requesting_admin_username,
                                     'note', p_note));
END;
$fn$;
