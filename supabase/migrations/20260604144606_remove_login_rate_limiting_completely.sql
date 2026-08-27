-- Remove TODO o sistema de rate-limiting / login bloqueado.
-- Vamos reconstruir do zero.

DROP FUNCTION IF EXISTS public.admin_unlock_login(text);
DROP FUNCTION IF EXISTS public.check_login_block(text);
DROP FUNCTION IF EXISTS public.clear_login_rate_limit(text);
DROP FUNCTION IF EXISTS public.get_blocked_logins();
DROP FUNCTION IF EXISTS public.record_login_failure(text);
DROP FUNCTION IF EXISTS public.log_security_event(text, text, text, integer, jsonb);

-- A tabela sai por último (remove policies + entrada na publicação realtime junto)
DROP TABLE IF EXISTS public.login_rate_limits CASCADE;
;
