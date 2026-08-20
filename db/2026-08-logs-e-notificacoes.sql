-- ============================================================================
-- GamerHub — Logs & notificações: lacunas encontradas na revisão (ago/2026)
-- ============================================================================
--
-- COMO RODAR: cole no SQL Editor do Supabase. Cada bloco é independente e
-- idempotente (só `CREATE OR REPLACE FUNCTION`); nenhum apaga dado.
--
-- Rode DEPOIS de `db/2026-08-otimizacao.sql` — o BLOCO 5 agenda a limpeza que
-- aquele arquivo criou.
--
--   BLOCO 1 — o painel do fundador escondia metade das notificações
--   BLOCO 2 — log de troca de cargo não dizia PARA QUEM
--   BLOCO 3 — usuário suspenso não era avisado
--   BLOCO 4 — desban negado não notificava ninguém
--   BLOCO 5 — agendar a retenção de logs
-- ============================================================================


-- ============================================================================
-- BLOCO 1 — owner_get_notifications
-- ============================================================================
-- Dois furos:
--
-- 1. O lado de `admin_notifications` filtrava por
--    `type IN ('new_user','new_live','live_ended','user_banned','staff_alert')`.
--    O sistema gera MUITO mais que isso — suspensão, banimento automático,
--    suspensão automática, pedido de desban, desban aprovado, live reativada,
--    pedido de reativação, tentativa de login de banido. Nada disso chegava ao
--    fundador. Agora o filtro sai: o painel do dono mostra toda notificação de
--    staff, e tipo novo aparece sozinho sem precisar mexer aqui de novo.
--
-- 2. O lado de `admin_logs` filtrava por `action IN (…,'set_role',…)`, mas
--    `set_role` só é gravado por `owner_set_role`. Troca de cargo feita por
--    admin/super_admin grava `admin_role_changed` — ou seja, a troca de cargo
--    mais comum do site NUNCA aparecia. Junto entram as ações de moderação de
--    conta que também ficavam de fora.
--
-- Bônus: `kind` passa a ser a própria action (em vez de 'activity'/'delete'
-- genéricos), o que deixa a UI escolher o ícone certo por evento.
CREATE OR REPLACE FUNCTION public.owner_get_notifications(p_limit integer DEFAULT 50)
  RETURNS TABLE(id uuid, kind text, actor text, action text, body text,
                severity text, category text, metadata jsonb, created_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    (SELECT l.id,
      l.action::TEXT,
      COALESCE(l.actor_username, l.admin_username, 'sistema')::TEXT,
      l.action::TEXT, l.details::TEXT,
      l.severity::TEXT, l.category::TEXT, l.metadata, l.created_at
    FROM admin_logs l
    WHERE l.action IN (
            'admin_ban', 'admin_unban', 'admin_role_changed', 'set_role',
            'admin_unban_requested', 'admin_unban_approved', 'admin_unban_denied',
            'user_suspended', 'auto_ban', 'auto_suspend',
            'auth_banned_attempt', 'admin_unlock_login', 'auth_account_deleted'
          )
       OR l.severity = 'critical'
       OR (l.severity = 'warning' AND l.category = 'security')
    ORDER BY l.created_at DESC LIMIT 40)
    UNION ALL
    -- Sem whitelist de tipo: notificação de staff nova aparece automaticamente.
    (SELECT n.id, n.type::TEXT,
      CASE WHEN n.type = 'staff_alert'
           THEN COALESCE(n.metadata->>'sender_username', 'staff')
           ELSE 'sistema' END::TEXT,
      n.type::TEXT, n.message::TEXT,
      CASE WHEN n.type IN ('staff_alert', 'auto_ban', 'user_banned') THEN 'warning'
           ELSE 'info' END::TEXT,
      'notification'::TEXT, n.metadata, n.created_at
    FROM admin_notifications n
    ORDER BY n.created_at DESC LIMIT 30)
  ) combined
  ORDER BY combined.created_at DESC
  LIMIT p_limit;
END;
$function$;


-- ============================================================================
-- BLOCO 2 — owner_set_role: log sem o alvo
-- ============================================================================
-- O log dizia só "Role alterada para admin pelo fundador" — sem dizer de QUEM.
-- Inútil numa auditoria. Passa a nomear o alvo e a guardar metadata, igual ao
-- `admin_set_role`. O resto da função é idêntico.
CREATE OR REPLACE FUNCTION public.owner_set_role(p_target_user_id uuid, p_new_role text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner_username TEXT; v_target_username TEXT; v_old_role TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado — apenas o fundador pode alterar roles.';
  END IF;
  IF p_target_user_id = auth.uid() THEN RAISE EXCEPTION 'Não é possível alterar a própria role.'; END IF;
  IF p_new_role NOT IN ('user','admin','super_admin') THEN RAISE EXCEPTION 'Role inválida: %', p_new_role; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Não é possível alterar a role do fundador.';
  END IF;

  SELECT username INTO v_owner_username FROM profiles WHERE id = auth.uid();
  SELECT username, role INTO v_target_username, v_old_role FROM profiles WHERE id = p_target_user_id;

  UPDATE profiles SET role = p_new_role, role_changed_at = now() WHERE id = p_target_user_id;

  INSERT INTO admin_logs (admin_id, admin_username, actor_id, actor_username,
                          action, details, category, severity, metadata)
  VALUES (auth.uid(), v_owner_username, auth.uid(), v_owner_username, 'set_role',
    'Role de @' || COALESCE(v_target_username, '?') || ' alterada de ' ||
      COALESCE(v_old_role, '?') || ' para ' || p_new_role || ' pelo fundador',
    'admin', 'info',
    jsonb_build_object('target_id', p_target_user_id, 'target_username', v_target_username,
                       'from_role', v_old_role, 'to_role', p_new_role));
END;
$function$;


-- ============================================================================
-- BLOCO 3 — o usuário suspenso não era avisado
-- ============================================================================
-- Banimento tem tela dedicada, mas SUSPENSÃO era silenciosa: só os admins
-- recebiam notificação. O usuário só descobria ao tentar postar e esbarrar no
-- aviso de suspenso, sem saber por quê nem até quando. Agora ele recebe uma
-- notificação (tipo 'moderation', que o sino do site já sabe renderizar).

CREATE OR REPLACE FUNCTION public.apply_suspension(p_user_id uuid, p_days integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text; v_caller_username text; v_target_role text; v_target_username text;
  v_until timestamptz := now() + (p_days || ' days')::interval;
BEGIN
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

  -- NOVO: avisa quem foi suspenso.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa por ' || p_days || ' dia(s). Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_mod_auto_suspend(p_user_id uuid, p_points integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_username text; v_until timestamptz := now() + interval '7 days';
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id
             AND (banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))) THEN
    RETURN;
  END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_suspend', '@' || v_username || ' suspenso automaticamente pelo sistema (' || p_points || ' pontos)',
    'security', NULL, 'Sistema', 'warning',
    jsonb_build_object('target_id', p_user_id, 'points', p_points, 'until', v_until), NULL, 'Sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_suspend', 'Suspensão automática',
    '@' || v_username || ' foi suspenso automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins', jsonb_build_object('target_username', v_username, 'points', p_points));

  -- NOVO: avisa quem foi suspenso. Sem isso a suspensão automática era
  -- completamente invisível pra quem levou.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa automaticamente por acúmulo de infrações. Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$function$;


-- ============================================================================
-- BLOCO 4 — desban negado sumia
-- ============================================================================
-- `approve_unban_request` avisa os admins; `deny_unban_request` só gravava log.
-- O admin que pediu o desban nunca ficava sabendo que foi negado. Agora gera
-- notificação de staff, igual à aprovação.
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
$function$;


-- ============================================================================
-- BLOCO 5 — agendar a limpeza de logs
-- ============================================================================
-- Depende de `cleanup_old_data()`, criada em `db/2026-08-otimizacao.sql`.
-- Retenção: admin_logs 90 dias · notificações lidas 30 dias · login_attempts
-- expirados 30 dias · chat de live encerrada 7 dias. Os painéis do site avisam
-- esse prazo na tela (`LOG_RETENTION_DAYS` em `src/lib/logMeta.js` — manter os
-- dois em sincronia).
--
-- Se o pg_cron não estiver disponível no projeto, o bloco não falha: só avisa,
-- e aí a função pode ser chamada na mão de tempos em tempos.
DO $$
BEGIN
  IF to_regprocedure('public.cleanup_old_data()') IS NULL THEN
    RAISE EXCEPTION 'Rode db/2026-08-otimizacao.sql primeiro (cleanup_old_data não existe).';
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível (%). Rode SELECT public.cleanup_old_data(); manualmente.', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamerhub-cleanup') THEN
      PERFORM cron.unschedule('gamerhub-cleanup');
    END IF;
    PERFORM cron.schedule('gamerhub-cleanup', '0 4 * * *', 'SELECT public.cleanup_old_data();');
    RAISE NOTICE 'Limpeza agendada: todo dia às 4h UTC.';
  ELSE
    RAISE NOTICE 'Sem pg_cron: agendamento não criado.';
  END IF;
END $$;
