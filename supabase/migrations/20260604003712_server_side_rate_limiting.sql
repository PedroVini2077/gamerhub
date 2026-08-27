CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  email TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_direct_access" ON public.login_rate_limits FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.record_login_failure(p_email TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attempts INTEGER := 0;
  v_blocked_until TIMESTAMPTZ;
  v_delay_ms BIGINT;
BEGIN
  SELECT attempts, blocked_until INTO v_attempts, v_blocked_until
  FROM login_rate_limits WHERE email = lower(trim(p_email));

  IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
    RETURN jsonb_build_object('attempts', v_attempts, 'blocked_until', v_blocked_until, 'blocked', true);
  END IF;

  IF v_blocked_until IS NOT NULL AND v_blocked_until <= NOW() THEN
    v_attempts := 0;
  END IF;

  v_attempts := COALESCE(v_attempts, 0) + 1;

  v_delay_ms := CASE
    WHEN v_attempts >= 7 THEN 86400000
    WHEN v_attempts = 6 THEN 3600000
    WHEN v_attempts = 5 THEN 900000
    WHEN v_attempts = 4 THEN 300000
    WHEN v_attempts = 3 THEN 60000
    WHEN v_attempts = 2 THEN 30000
    ELSE 0
  END;

  v_blocked_until := CASE
    WHEN v_delay_ms > 0 THEN NOW() + (v_delay_ms || ' milliseconds')::INTERVAL
    ELSE NULL
  END;

  INSERT INTO login_rate_limits (email, attempts, blocked_until, updated_at)
  VALUES (lower(trim(p_email)), v_attempts, v_blocked_until, NOW())
  ON CONFLICT (email) DO UPDATE
    SET attempts = EXCLUDED.attempts,
        blocked_until = EXCLUDED.blocked_until,
        updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'blocked_until', v_blocked_until,
    'blocked', v_blocked_until IS NOT NULL AND v_blocked_until > NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_login_block(p_email TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row login_rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM login_rate_limits WHERE email = lower(trim(p_email));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('blocked', false, 'attempts', 0);
  END IF;
  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > NOW() THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'blocked_until', v_row.blocked_until,
      'attempts', v_row.attempts,
      'permanent', v_row.attempts >= 7
    );
  END IF;
  RETURN jsonb_build_object('blocked', false, 'attempts', v_row.attempts);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(p_email TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM login_rate_limits WHERE email = lower(trim(p_email));
END;
$$;
;
