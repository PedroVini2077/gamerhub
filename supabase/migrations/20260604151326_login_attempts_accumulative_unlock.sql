-- Coluna explícita de bloqueio permanente (separa "contagem" de "flag permanente")
ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS permanent boolean NOT NULL DEFAULT false;

-- ── check_login_status ──
CREATE OR REPLACE FUNCTION public.check_login_status(p_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_attempts integer := 0;
  v_blocked_until timestamptz;
  v_permanent boolean := false;
BEGIN
  SELECT attempts, blocked_until, permanent INTO v_attempts, v_blocked_until, v_permanent
    FROM public.login_attempts WHERE email = lower(trim(p_email));
  v_attempts  := COALESCE(v_attempts, 0);
  v_permanent := COALESCE(v_permanent, false);
  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'blocked', v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()),
    'permanent', v_permanent,
    'blocked_until', v_blocked_until
  );
END;
$$;

-- ── register_login_attempt ──
-- 5+ falhas = 15min · 10+ falhas = permanente. Conta NUNCA reseta aqui.
CREATE OR REPLACE FUNCTION public.register_login_attempt(p_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_attempts integer := 0;
  v_blocked_until timestamptz;
  v_permanent boolean := false;
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

  RETURN jsonb_build_object('attempts', v_attempts,
    'blocked', v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()),
    'permanent', v_permanent, 'blocked_until', v_blocked_until);
END;
$$;

-- ── admin_unlock_login: ACUMULATIVO ──
-- Só tira o bloqueio (libera pra tentar) mas MANTÉM a contagem de tentativas.
-- Ex: bloqueado em 5 -> desbloqueia -> continua contando 6,7,8,9,10(permanente).
CREATE OR REPLACE FUNCTION public.admin_unlock_login(p_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  UPDATE public.login_attempts
     SET blocked_until = NULL, permanent = false, updated_at = now()
   WHERE email = lower(trim(p_email));
END;
$$;

-- ── get_blocked_logins: usa a coluna permanent ──
CREATE OR REPLACE FUNCTION public.get_blocked_logins()
 RETURNS TABLE(email text, attempts integer, blocked_until timestamptz,
   permanent boolean, currently_blocked boolean, updated_at timestamptz, username text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  RETURN QUERY
  SELECT la.email, la.attempts, la.blocked_until,
    la.permanent,
    (la.permanent OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())) AS currently_blocked,
    la.updated_at, p.username
  FROM public.login_attempts la
  LEFT JOIN auth.users   au ON au.email = la.email
  LEFT JOIN public.profiles p ON p.id   = au.id
  WHERE la.attempts >= 5
    AND la.updated_at > now() - INTERVAL '24 hours'
  ORDER BY
    (la.permanent OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())) DESC,
    la.updated_at DESC;
END;
$$;
;
