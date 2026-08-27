-- 1. Adiciona a tabela à publicação realtime (faltava — por isso o painel não atualizava sozinho)
ALTER PUBLICATION supabase_realtime ADD TABLE public.login_rate_limits;

-- 2. Reescreve get_blocked_logins para não esconder entradas entre janelas de bloqueio.
--    Mostra qualquer email que já foi bloqueado (attempts >= 2) nas últimas 24h,
--    OU que esteja bloqueado agora. Adiciona currently_blocked e updated_at.
DROP FUNCTION IF EXISTS public.get_blocked_logins();

CREATE FUNCTION public.get_blocked_logins()
 RETURNS TABLE(
   email text,
   attempts integer,
   blocked_until timestamptz,
   permanent boolean,
   currently_blocked boolean,
   updated_at timestamptz,
   username text,
   profile_id uuid
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (lrl.blocked_until IS NOT NULL AND lrl.blocked_until > NOW())::BOOLEAN AS currently_blocked,
    lrl.updated_at,
    p.username,
    p.id AS profile_id
  FROM public.login_rate_limits lrl
  LEFT JOIN auth.users   au ON au.email = lrl.email
  LEFT JOIN public.profiles p ON p.id   = au.id
  WHERE (lrl.blocked_until IS NOT NULL AND lrl.blocked_until > NOW())
     OR (lrl.attempts >= 2 AND lrl.updated_at > NOW() - INTERVAL '24 hours')
  ORDER BY
    (lrl.blocked_until IS NOT NULL AND lrl.blocked_until > NOW()) DESC,
    lrl.attempts DESC,
    lrl.updated_at DESC;
END;
$function$;
;
