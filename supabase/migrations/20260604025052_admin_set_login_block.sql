CREATE OR REPLACE FUNCTION admin_set_login_block(p_profile_id UUID, p_blocked BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT;
  v_email TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_profile_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_blocked THEN
    INSERT INTO public.login_rate_limits (email, attempts, blocked_until, updated_at)
    VALUES (lower(trim(v_email)), 7, NOW() + INTERVAL '87600 hours', NOW())
    ON CONFLICT (email) DO UPDATE
      SET attempts      = 7,
          blocked_until = NOW() + INTERVAL '87600 hours',
          updated_at    = NOW();
  ELSE
    DELETE FROM public.login_rate_limits WHERE email = lower(trim(v_email));
  END IF;
END;
$$;
;
