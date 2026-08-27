-- Painel mostra APENAS quem está bloqueado agora (temporário ou permanente).
-- Assim que o super admin desbloqueia, a entrada sai da lista.
-- A contagem continua guardada no banco (acúmulo), só não aparece no painel.
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
    true AS currently_blocked,
    la.updated_at, p.username
  FROM public.login_attempts la
  LEFT JOIN auth.users   au ON au.email = la.email
  LEFT JOIN public.profiles p ON p.id   = au.id
  WHERE la.permanent
     OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())
  ORDER BY la.permanent DESC, la.updated_at DESC;
END;
$$;
;
