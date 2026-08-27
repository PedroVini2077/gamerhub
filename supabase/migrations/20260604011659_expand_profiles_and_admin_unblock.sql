-- 1. Novos campos no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date   DATE,
  ADD COLUMN IF NOT EXISTS state        VARCHAR(2),
  ADD COLUMN IF NOT EXISTS platform     TEXT,
  ADD COLUMN IF NOT EXISTS favorite_games TEXT,
  ADD COLUMN IF NOT EXISTS discord      TEXT,
  ADD COLUMN IF NOT EXISTS twitch       TEXT,
  ADD COLUMN IF NOT EXISTS youtube      TEXT,
  ADD COLUMN IF NOT EXISTS playstyle    TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_platform,
  DROP CONSTRAINT IF EXISTS check_playstyle;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_platform  CHECK (platform  IS NULL OR platform  IN ('PC','PlayStation','Xbox','Mobile','Switch','Multi')),
  ADD CONSTRAINT check_playstyle CHECK (playstyle IS NULL OR playstyle IN ('casual','competitivo','ambos'));

-- 2. RPC get_blocked_logins — retorna logins bloqueados (super_admin only)
CREATE OR REPLACE FUNCTION public.get_blocked_logins()
RETURNS TABLE(
  email        TEXT,
  attempts     INTEGER,
  blocked_until TIMESTAMPTZ,
  permanent    BOOLEAN,
  username     TEXT,
  profile_id   UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    lrl.email,
    lrl.attempts,
    lrl.blocked_until,
    (lrl.attempts >= 7)::BOOLEAN AS permanent,
    p.username,
    p.id AS profile_id
  FROM public.login_rate_limits lrl
  LEFT JOIN auth.users  au ON au.email  = lrl.email
  LEFT JOIN public.profiles p ON p.id   = au.id
  WHERE lrl.blocked_until IS NOT NULL
    AND lrl.blocked_until > NOW()
  ORDER BY lrl.attempts DESC, lrl.updated_at DESC;
END;
$$;

-- 3. RPC admin_unlock_login — desbloqueia email (super_admin only)
CREATE OR REPLACE FUNCTION public.admin_unlock_login(p_email TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role != 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  DELETE FROM public.login_rate_limits WHERE email = p_email;
END;
$$;
;
