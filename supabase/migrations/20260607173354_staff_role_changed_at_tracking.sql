create or replace function admin_set_role(p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  update profiles set role = p_new_role, role_changed_at = now() where id = p_user_id;
  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'admin_role_changed',
    'Role de @'||v_target_username||' alterada para '||p_new_role||' por @'||v_caller_username, 'admin', 'info');
end;
$function$;

create or replace function owner_set_role(p_target_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_owner_username TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado — apenas o fundador pode alterar roles.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível alterar a própria role.';
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Role inválida: %', p_new_role;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Não é possível alterar a role do fundador.';
  END IF;

  SELECT username INTO v_owner_username FROM profiles WHERE id = auth.uid();

  UPDATE profiles SET role = p_new_role, role_changed_at = now() WHERE id = p_target_user_id;

  INSERT INTO admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  SELECT auth.uid(), v_owner_username, auth.uid(), v_owner_username,
    'set_role',
    'Role alterada para ' || p_new_role || ' pelo fundador',
    'admin', 'info';
END;
$function$;
;
