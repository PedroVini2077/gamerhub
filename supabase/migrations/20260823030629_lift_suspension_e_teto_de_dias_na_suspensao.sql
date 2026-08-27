-- Por que esta migracao existe — FALHA DE PRIVILEGIO
--
-- Provado em ROLLBACK, com papeis reais:
--   1. um ADMIN (rank 2) chamou apply_suspension(alvo, 36500) e foi ACEITO:
--      suspenso ate 2126. `p_days` nao tinha teto nenhum.
--   2. o OWNER tentou desfazer com UPDATE direto. O comando "passou" sem erro,
--      mas o trigger `guard_profile_privileged_cols` reverteu EM SILENCIO —
--      continuou suspenso ate 2126.
--   3. nao existia NENHUMA funcao para tirar suspensao.
--
-- Somando: um admin podia silenciar qualquer usuario para sempre, e nem o
-- fundador conseguia desfazer. Suspensao virava um banimento permanente que
-- pulava toda a hierarquia do ban (onde so super_admin/owner desbanem).
--
-- Duas correcoes:
--   a) teto de 30 dias em apply_suspension. Mais que isso e caso de BAN, que
--      tem hierarquia propria e caminho de reversao.
--   b) lift_suspension: a reversao que faltava, com a MESMA regra de
--      hierarquia do apply (staff, e rank estritamente maior que o alvo).

-- (a) teto de dias
CREATE OR REPLACE FUNCTION public.apply_suspension(p_user_id uuid, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller_role text; v_caller_username text; v_target_role text; v_target_username text;
  v_until timestamptz;
BEGIN
  -- Sem teto, `p_days` gigante virava banimento permanente sem passar pelo ban.
  IF p_days IS NULL OR p_days < 1 OR p_days > 30 THEN
    RAISE EXCEPTION 'Suspensao deve ser de 1 a 30 dias. Para mais que isso, use banimento.';
  END IF;
  v_until := now() + (p_days || ' days')::interval;

  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot suspend equal or higher role';
  END IF;

  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_suspended', '@' || v_target_username || ' suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'security', auth.uid(), v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'days', p_days, 'until', v_until), auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_suspended', 'Usuário suspenso',
    '@' || v_target_username || ' foi suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username, 'days', p_days));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa por ' || p_days || ' dia(s). Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$fn$;

-- (b) a reversao que nao existia
CREATE OR REPLACE FUNCTION public.lift_suspension(p_user_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text; v_estava timestamptz;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  SELECT role, username, suspended_until INTO v_target_role, v_target_username, v_estava
    FROM profiles WHERE id = p_user_id;

  IF v_target_username IS NULL THEN RAISE EXCEPTION 'Usuario nao encontrado'; END IF;

  -- Mesma hierarquia do apply: quem pode suspender pode tirar. Escrita com
  -- `role_rank` de proposito — lista literal de papeis ja causou tres falhas
  -- neste projeto (ver CLAUDE.md §1.3).
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot lift suspension of equal or higher role';
  END IF;

  IF v_estava IS NULL OR v_estava <= now() THEN
    RAISE EXCEPTION 'Este usuario nao esta suspenso.';
  END IF;

  UPDATE profiles SET suspended_until = NULL WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_unsuspended',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username
      || coalesce(' — ' || p_note, ''),
    'security', auth.uid(), v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'era_ate', v_estava, 'nota', p_note),
    auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_unsuspended', 'Suspensão removida',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua suspensão foi removida. Você já pode publicar normalmente.');
END;
$fn$;

-- Defesa em profundidade: alem da checagem interna por auth.uid().
REVOKE ALL ON FUNCTION public.lift_suspension(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lift_suspension(uuid, text) TO authenticated;;
