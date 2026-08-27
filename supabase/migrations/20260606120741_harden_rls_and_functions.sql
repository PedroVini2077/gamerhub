-- 1) unban_requests: remove políticas duplicadas e "sempre-true".
-- Escrita é só via RPC (request_unban / approve / deny), que bypassa RLS.
drop policy if exists authenticated_insert_unban_requests on public.unban_requests;
drop policy if exists unban_req_insert on public.unban_requests;
drop policy if exists authenticated_update_unban_requests on public.unban_requests;
drop policy if exists unban_req_update on public.unban_requests;
drop policy if exists authenticated_select_unban_requests on public.unban_requests;
drop policy if exists unban_req_select on public.unban_requests;

create policy unban_req_select_scoped on public.unban_requests
  for select to authenticated
  using (
    requesting_admin_id = (select auth.uid())
    or exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('super_admin','owner'))
  );

-- 2) search_path fixo nas 4 funções que estavam mutáveis
alter function public.role_rank(text) set search_path = 'public';
alter function public.set_live_ended_at() set search_path = 'public';
alter function public.notify_admin_new_live() set search_path = 'public';
alter function public.notify_admin_reactivation_request() set search_path = 'public';

-- 3) Defesa em profundidade: anon não executa funções privilegiadas
--    (já bloqueiam internamente via auth.uid(), mas removemos o acesso de vez).
revoke execute on function public.owner_get_stats()                          from anon;
revoke execute on function public.owner_get_users()                          from anon;
revoke execute on function public.owner_get_audit_logs(integer,integer,text,text) from anon;
revoke execute on function public.owner_get_notifications(integer)           from anon;
revoke execute on function public.owner_get_metrics()                        from anon;
revoke execute on function public.owner_set_role(uuid,text)                  from anon;
revoke execute on function public.owner_set_site_config(text,text)           from anon;
revoke execute on function public.admin_set_role(uuid,text)                  from anon;
revoke execute on function public.ban_user(uuid,text,text)                   from anon;
revoke execute on function public.unban_user(uuid,text)                      from anon;
revoke execute on function public.approve_unban_request(uuid)               from anon;
revoke execute on function public.deny_unban_request(uuid,text)             from anon;
revoke execute on function public.request_unban(uuid,text)                  from anon;
revoke execute on function public.admin_unlock_login(text)                  from anon;
revoke execute on function public.get_blocked_logins()                      from anon;
;
