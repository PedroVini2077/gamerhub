-- ── Verifica o status de bloqueio de um email (chamado ANTES de tentar login) ──
CREATE FUNCTION public.check_login_status(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_attempts integer := 0;
  v_blocked_until timestamptz;
  v_permanent boolean;
  v_blocked boolean;
BEGIN
  SELECT attempts, blocked_until INTO v_attempts, v_blocked_until
    FROM public.login_attempts WHERE email = lower(trim(p_email));

  v_attempts  := COALESCE(v_attempts, 0);
  v_permanent := v_attempts >= 10;
  v_blocked   := v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now());

  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'blocked', v_blocked,
    'permanent', v_permanent,
    'blocked_until', v_blocked_until
  );
END;
$$;

-- ── Registra uma falha de login e aplica a regra de bloqueio ──
-- Regras: 5+ falhas = 15 min · 10+ falhas = permanente
CREATE FUNCTION public.register_login_attempt(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_attempts integer := 0;
  v_blocked_until timestamptz;
  v_permanent boolean;
  v_blocked boolean;
BEGIN
  SELECT attempts, blocked_until INTO v_attempts, v_blocked_until
    FROM public.login_attempts WHERE email = v_email;

  v_attempts := COALESCE(v_attempts, 0);

  -- Se já está bloqueado, não conta de novo — apenas retorna o estado atual
  IF v_attempts >= 10 OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()) THEN
    RETURN jsonb_build_object(
      'attempts', v_attempts,
      'blocked', true,
      'permanent', v_attempts >= 10,
      'blocked_until', v_blocked_until
    );
  END IF;

  -- Acumula a falha
  v_attempts := v_attempts + 1;
  v_blocked_until := CASE
    WHEN v_attempts >= 10 THEN NULL                          -- permanente (via attempts)
    WHEN v_attempts >= 5  THEN now() + INTERVAL '15 minutes' -- bloqueio temporário
    ELSE NULL                                                -- ainda livre
  END;

  INSERT INTO public.login_attempts (email, attempts, blocked_until, updated_at)
  VALUES (v_email, v_attempts, v_blocked_until, now())
  ON CONFLICT (email) DO UPDATE
    SET attempts = EXCLUDED.attempts,
        blocked_until = EXCLUDED.blocked_until,
        updated_at = EXCLUDED.updated_at;

  v_permanent := v_attempts >= 10;
  v_blocked   := v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now());

  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'blocked', v_blocked,
    'permanent', v_permanent,
    'blocked_until', v_blocked_until
  );
END;
$$;

-- ── Zera as tentativas no login bem-sucedido (só o próprio usuário autenticado) ──
CREATE FUNCTION public.reset_login_attempts()
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE email = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
END;
$$;

-- Permissões: login page chama check/register como anônimo
GRANT EXECUTE ON FUNCTION public.check_login_status(text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_login_attempt(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_login_attempts()       TO authenticated;
;
