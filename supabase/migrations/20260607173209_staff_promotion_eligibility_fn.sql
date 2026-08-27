create or replace function check_staff_eligibility(p_user_id uuid, p_target_role text default 'admin')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_profile           profiles%rowtype;
  v_xp                int;
  v_account_age_days  int;
  v_rank_ok           boolean;
  v_ban_ok            boolean;
  v_ban_reason        text;
  v_admin_tenure_days int := null;
  v_tenure_ok         boolean := true;
  v_eligible          boolean;
begin
  if p_target_role not in ('admin','super_admin') then
    raise exception 'Cargo inválido: %', p_target_role;
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if v_profile.id is null then
    raise exception 'Usuário não encontrado';
  end if;

  v_account_age_days := floor(extract(epoch from now() - v_profile.created_at) / 86400);
  v_xp := coalesce((get_user_xp(p_user_id)->>'xp')::int, 0);
  v_rank_ok := v_xp >= 1000; -- piso do tier Elite

  -- Histórico de banimento como filtro de elegibilidade (não mexe no rank público)
  if coalesce(v_profile.ban_count, 0) = 0 then
    v_ban_ok := true;
    v_ban_reason := null;
  elsif v_profile.ban_count = 1 then
    if v_profile.banned_at is not null and now() - v_profile.banned_at >= interval '6 months' then
      v_ban_ok := true;
      v_ban_reason := null;
    else
      v_ban_ok := false;
      v_ban_reason := 'cooldown_6_meses';
    end if;
  else
    v_ban_ok := false;
    v_ban_reason := 'multiplos_banimentos';
  end if;

  -- Pré-requisito extra pra super_admin: já ser admin há 1 ano com cargo estável
  if p_target_role = 'super_admin' then
    if v_profile.role <> 'admin' then
      v_tenure_ok := false;
    else
      v_admin_tenure_days := floor(extract(epoch from now() - v_profile.role_changed_at) / 86400);
      v_tenure_ok := v_admin_tenure_days >= 365;
    end if;
  end if;

  v_eligible := (v_account_age_days >= 60)
            and v_rank_ok
            and v_ban_ok
            and v_tenure_ok
            and coalesce(v_profile.banned, false) = false;

  return jsonb_build_object(
    'eligible',          v_eligible,
    'target_role',       p_target_role,
    'account_age_days',  v_account_age_days,
    'account_age_ok',    v_account_age_days >= 60,
    'xp',                v_xp,
    'rank_ok',           v_rank_ok,
    'ban_count',         coalesce(v_profile.ban_count, 0),
    'ban_ok',            v_ban_ok,
    'ban_reason',        v_ban_reason,
    'currently_banned',  coalesce(v_profile.banned, false),
    'admin_tenure_days', v_admin_tenure_days,
    'tenure_ok',         v_tenure_ok
  );
end;
$$;
;
