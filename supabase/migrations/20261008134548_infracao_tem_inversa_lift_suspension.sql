-- O poder do admin: remover a suspensão PERDOA os pontos que a causaram.
-- Sem isto a remoção era decorativa — a próxima infração re-suspendia na hora.

-- `p_note` MANTEM o `DEFAULT NULL`: o Postgres recusa um CREATE OR REPLACE que
-- remova default de funcao existente ("cannot remove parameter defaults"), e
-- com razao — sem ele, toda chamada de um argumento so (`lift_suspension(id)`)
-- passaria a nao resolver.
CREATE OR REPLACE FUNCTION public.lift_suspension(p_user_id uuid, p_note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text; v_estava timestamptz;
  v_revogadas int; v_pontos int;
BEGIN
  PERFORM public.exige_operador_ativo();
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  -- AUTORIZACAO PRIMEIRO (SEC-032).
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;

  SELECT role, username, suspended_until INTO v_target_role, v_target_username, v_estava
    FROM profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN RAISE EXCEPTION 'Usuario nao encontrado'; END IF;

  -- Mesma hierarquia do apply: quem pode suspender pode tirar. `role_rank` e
  -- nao lista literal — lista literal ja causou tres falhas neste projeto.
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot lift suspension of equal or higher role';
  END IF;
  IF v_estava IS NULL OR v_estava <= now() THEN
    RAISE EXCEPTION 'Este usuario nao esta suspenso.';
  END IF;

  UPDATE profiles SET suspended_until = NULL WHERE id = p_user_id;

  -- A soma e medida ANTES do UPDATE: e exatamente o que esta sendo perdoado.
  -- A 1a versao somava depois, filtrando `revogada_por = auth.uid()` numa
  -- janela de 1 segundo — fragil sem motivo, e capaz de contar a revogacao de
  -- uma chamada anterior do mesmo admin.
  SELECT COALESCE(SUM(points), 0) INTO v_pontos
    FROM violations WHERE user_id = p_user_id AND revogada_em IS NULL;

  -- A PARTE NOVA, e ela e o que faz a remocao valer algo. Sem isto, os pontos
  -- que causaram a suspensao ficavam de pe: a proxima infracao de QUALQUER
  -- tamanho voltava a cruzar o limiar e re-suspendia na hora. O moderador
  -- perdoava e o sistema desfazia o perdao sozinho.
  UPDATE violations
     SET revogada_em     = now(),
         revogada_por    = auth.uid(),
         revogada_motivo = 'suspensao removida por @' || v_caller_username
                           || coalesce(' — ' || p_note, '')
   WHERE user_id = p_user_id AND revogada_em IS NULL;
  GET DIAGNOSTICS v_revogadas = ROW_COUNT;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_unsuspended',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username
      || coalesce(' — ' || p_note, '')
      || CASE WHEN v_revogadas > 0
              THEN ' (e ' || v_revogadas || ' infração(ões) de ' || v_pontos || ' ponto(s) foram perdoadas)'
              ELSE '' END,
    'security', auth.uid(), v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'era_ate', v_estava, 'nota', p_note,
                       'infracoes_revogadas', v_revogadas, 'pontos_perdoados', v_pontos),
    auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_unsuspended', 'Suspensão removida',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua suspensão foi removida. Você já pode publicar normalmente.');
END;
$function$;

REVOKE ALL ON FUNCTION public.lift_suspension(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lift_suspension(uuid, text) TO authenticated;
