-- ════════════════════════════════════════════════════════════════
-- Sistema de bloqueio por tentativas — RECONSTRUÍDO DO ZERO
-- Servidor é a única fonte de verdade. Regras:
--   1-4 falhas: contando, sem bloqueio
--   5+ falhas:  bloqueia 15 min (libera sozinho)
--   10+ falhas: bloqueio PERMANENTE (só super admin libera)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE public.login_attempts (
  email         text PRIMARY KEY,
  attempts      integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: ninguém acessa direto. Só via funções SECURITY DEFINER abaixo.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_direct_access ON public.login_attempts FOR ALL USING (false);

-- ── Função do painel: lista bloqueados (super admin) ──
CREATE FUNCTION public.get_blocked_logins()
 RETURNS TABLE(
   email text,
   attempts integer,
   blocked_until timestamptz,
   permanent boolean,
   currently_blocked boolean,
   updated_at timestamptz,
   username text
 )
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;

  RETURN QUERY
  SELECT
    la.email,
    la.attempts,
    la.blocked_until,
    (la.attempts >= 10) AS permanent,
    (la.attempts >= 10 OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())) AS currently_blocked,
    la.updated_at,
    p.username
  FROM public.login_attempts la
  LEFT JOIN auth.users   au ON au.email = la.email
  LEFT JOIN public.profiles p ON p.id   = au.id
  WHERE la.attempts >= 5            -- só quem já atingiu o limite ao menos uma vez
    AND la.updated_at > now() - INTERVAL '24 hours'
  ORDER BY
    (la.attempts >= 10 OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())) DESC,
    la.updated_at DESC;
END;
$$;

-- ── Desbloquear (super admin): zera o registro ──
CREATE FUNCTION public.admin_unlock_login(p_email text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  DELETE FROM public.login_attempts WHERE email = lower(trim(p_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_logins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_login(text) TO authenticated;

-- ── Entradas de DEMONSTRAÇÃO (pra ver o painel funcionando) ──
INSERT INTO public.login_attempts (email, attempts, blocked_until, updated_at) VALUES
  ('demo.bloqueado@exemplo.com', 5,  now() + INTERVAL '15 minutes', now()),
  ('demo.permanente@exemplo.com', 11, NULL, now());
;
