-- Corrige escalada de privilégio: cliente (authenticated/anon) não pode mais
-- alterar role/banned/ban_* via UPDATE direto na tabela profiles.
-- Funções SECURITY DEFINER (ban_user, unban_user, owner_set_role, admin_set_role,
-- approve_unban_request) rodam como o dono do banco e continuam funcionando.

create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  -- Escritas do cliente rodam como 'authenticated'/'anon'.
  -- Dentro de função SECURITY DEFINER, current_user = dono do banco (liberado).
  if current_user in ('authenticated','anon') then
    new.role               := old.role;
    new.banned             := old.banned;
    new.ban_reason         := old.ban_reason;
    new.ban_details        := old.ban_details;
    new.banned_by          := old.banned_by;
    new.banned_by_username := old.banned_by_username;
    new.banned_at          := old.banned_at;
    new.ban_count          := old.ban_count;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileged on public.profiles;
create trigger trg_guard_profile_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_cols();

-- RPC para o painel Admin trocar roles com hierarquia (antes era UPDATE direto)
create or replace function public.admin_set_role(p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  select role, username into v_target_role, v_target_username from profiles where id = p_user_id;
  if v_target_role is null then raise exception 'Usuário não encontrado'; end if;
  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;
  if p_user_id = v_caller_id then raise exception 'Não é possível alterar a própria role'; end if;
  if p_new_role not in ('user','admin','super_admin') then raise exception 'Role inválida: %', p_new_role; end if;
  if v_target_role = 'owner' then raise exception 'Não é possível alterar a role do fundador'; end if;
  if role_rank(v_caller_role) <= role_rank(v_target_role) then
    raise exception 'Acesso negado: cargo igual ou superior';
  end if;
  if role_rank(v_caller_role) < role_rank(p_new_role) then
    raise exception 'Acesso negado: cargo acima do seu';
  end if;
  update profiles set role = p_new_role where id = p_user_id;
  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'admin_role_changed',
    'Role de @'||v_target_username||' alterada para '||p_new_role||' por @'||v_caller_username, 'admin', 'info');
end;
$$;
;
