-- Remove o RPC errado que criei
DROP FUNCTION IF EXISTS public.admin_set_login_block(UUID, BOOLEAN);

-- Corrige record_login_failure: não resetar tentativas quando o bloqueio expira.
-- Antes: bloqueio de 30s expirava → tentativas voltavam a 0 → nunca escalava para 5min/15min/1h.
-- Agora: tentativas acumulam até o admin desbloquear ou o login ter sucesso.
CREATE OR REPLACE FUNCTION public.record_login_failure(p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts    INTEGER := 0;
  v_blocked_until TIMESTAMPTZ;
  v_delay_ms    BIGINT;
BEGIN
  SELECT attempts, blocked_until
    INTO v_attempts, v_blocked_until
    FROM login_rate_limits
   WHERE email = lower(trim(p_email));

  -- Se ainda está bloqueado, não altera — retorna estado atual
  IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
    RETURN jsonb_build_object(
      'attempts',     v_attempts,
      'blocked_until', v_blocked_until,
      'blocked',       true
    );
  END IF;

  -- Acumula tentativas (NÃO reseta quando o bloqueio expira)
  v_attempts := COALESCE(v_attempts, 0) + 1;

  v_delay_ms := CASE
    WHEN v_attempts >= 7 THEN 86400000   -- 24h
    WHEN v_attempts =  6 THEN 3600000    -- 1h
    WHEN v_attempts =  5 THEN 900000     -- 15min
    WHEN v_attempts =  4 THEN 300000     -- 5min
    WHEN v_attempts =  3 THEN 60000      -- 1min
    WHEN v_attempts =  2 THEN 30000      -- 30s
    ELSE 0
  END;

  v_blocked_until := CASE
    WHEN v_delay_ms > 0 THEN NOW() + (v_delay_ms || ' milliseconds')::INTERVAL
    ELSE NULL
  END;

  INSERT INTO login_rate_limits (email, attempts, blocked_until, updated_at)
  VALUES (lower(trim(p_email)), v_attempts, v_blocked_until, NOW())
  ON CONFLICT (email) DO UPDATE
    SET attempts      = EXCLUDED.attempts,
        blocked_until = EXCLUDED.blocked_until,
        updated_at    = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'attempts',      v_attempts,
    'blocked_until', v_blocked_until,
    'blocked',       v_blocked_until IS NOT NULL AND v_blocked_until > NOW()
  );
END;
$$;
;
