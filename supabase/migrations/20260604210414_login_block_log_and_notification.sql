CREATE OR REPLACE FUNCTION public.register_login_attempt(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(p_email));
  v_attempts integer := 0;
  v_blocked_until timestamptz;
  v_permanent boolean := false;
  v_username text;
BEGIN
  SELECT attempts, blocked_until, permanent INTO v_attempts, v_blocked_until, v_permanent
    FROM public.login_attempts WHERE email = v_email;
  v_attempts  := COALESCE(v_attempts, 0);
  v_permanent := COALESCE(v_permanent, false);

  -- Já bloqueado? Não conta de novo, retorna o estado atual
  IF v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()) THEN
    RETURN jsonb_build_object('attempts', v_attempts, 'blocked', true,
      'permanent', v_permanent, 'blocked_until', v_blocked_until);
  END IF;

  -- Acumula a falha e decide o bloqueio
  v_attempts := v_attempts + 1;
  IF v_attempts >= 10 THEN
    v_permanent := true;  v_blocked_until := NULL;
  ELSIF v_attempts >= 5 THEN
    v_permanent := false; v_blocked_until := now() + INTERVAL '15 minutes';
  ELSE
    v_permanent := false; v_blocked_until := NULL;
  END IF;

  INSERT INTO public.login_attempts (email, attempts, blocked_until, permanent, updated_at)
  VALUES (v_email, v_attempts, v_blocked_until, v_permanent, now())
  ON CONFLICT (email) DO UPDATE
    SET attempts = EXCLUDED.attempts,
        blocked_until = EXCLUDED.blocked_until,
        permanent = EXCLUDED.permanent,
        updated_at = EXCLUDED.updated_at;

  -- Acabou de bloquear? Registra LOG técnico completo + NOTIFICAÇÃO geral.
  -- (só chega aqui quando NÃO estava bloqueado antes, então é uma transição real)
  IF v_permanent OR v_blocked_until IS NOT NULL THEN
    -- tenta achar o username pra enriquecer o log
    SELECT p.username INTO v_username
      FROM auth.users au JOIN public.profiles p ON p.id = au.id
     WHERE au.email = v_email;

    -- LOG: tudo, detalhado (aba Logs › Segurança)
    INSERT INTO public.admin_logs
      (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
    VALUES (
      CASE WHEN v_permanent THEN 'auth_permanent_block' ELSE 'auth_rate_limited' END,
      CASE WHEN v_permanent
        THEN 'Login de ' || v_email || COALESCE(' (@' || v_username || ')', '') ||
             ' BLOQUEADO PERMANENTEMENTE após ' || v_attempts || ' tentativas falhas consecutivas'
        ELSE 'Login de ' || v_email || COALESCE(' (@' || v_username || ')', '') ||
             ' bloqueado por 15 min após ' || v_attempts || ' tentativas falhas consecutivas'
      END,
      'security', NULL, COALESCE(v_username, 'sistema'),
      CASE WHEN v_permanent THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('email', v_email, 'attempts', v_attempts,
        'permanent', v_permanent, 'blocked_until', v_blocked_until),
      NULL, 'sistema'
    );

    -- NOTIFICAÇÃO: geral, sem detalhe técnico (aba Notificações)
    INSERT INTO public.admin_notifications (type, title, message, audience, metadata)
    VALUES (
      'security_alert',
      CASE WHEN v_permanent THEN 'Conta bloqueada permanentemente' ELSE 'Conta bloqueada temporariamente' END,
      CASE WHEN v_permanent
        THEN 'A conta ' || v_email || ' foi bloqueada por segurança e precisa de revisão de um super admin.'
        ELSE 'A conta ' || v_email || ' foi bloqueada temporariamente por segurança.'
      END,
      'all_admins',
      jsonb_build_object('email', v_email, 'permanent', v_permanent)
    );
  END IF;

  RETURN jsonb_build_object('attempts', v_attempts,
    'blocked', v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()),
    'permanent', v_permanent, 'blocked_until', v_blocked_until);
END;
$function$;;
