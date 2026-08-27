-- Defesa em profundidade: funções SECURITY DEFINER administrativas/owner e de
-- pós-login não devem ser chamáveis por anon via /rest/v1/rpc. Já se protegem
-- internamente via auth.uid(), mas tirar o EXECUTE de anon fecha a porta antes.
-- REVOKE de PUBLIC, anon (algumas tinham grant explícito a anon) + GRANT a authenticated.
-- Mantidas executáveis por anon (necessárias no fluxo de login): check_login_status,
-- register_login_attempt, get_user_xp.
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_unlock_login(text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.admin_unlock_login(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_unban_request(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.approve_unban_request(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.deny_unban_request(uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.deny_unban_request(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid,text,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.ban_user(uuid,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.unban_user(uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.unban_user(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_unban(uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.request_unban(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_blocked_logins() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.get_blocked_logins() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_get_audit_logs(integer,integer,text,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_get_audit_logs(integer,integer,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_get_metrics() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_get_metrics() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_get_notifications(integer) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_get_notifications(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_get_stats() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_get_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_get_users() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_get_users() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_set_role(uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_set_role(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_set_site_config(text,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.owner_set_site_config(text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_login_attempts() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.reset_login_attempts() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_banned_login_attempt(text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.record_banned_login_attempt(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;;
