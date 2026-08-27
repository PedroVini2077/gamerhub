create or replace function nominate_staff(p_candidate_id uuid, p_target_role text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_id     uuid := auth.uid();
  v_caller_role   text;
  v_candidate_role text;
  v_is_self       boolean;
  v_eligibility   jsonb;
  v_id            uuid;
begin
  if p_target_role not in ('admin','super_admin') then
    raise exception 'Cargo inválido: %', p_target_role;
  end if;

  select role into v_caller_role from profiles where id = v_caller_id;
  select role into v_candidate_role from profiles where id = p_candidate_id;
  if v_candidate_role is null then raise exception 'Usuário não encontrado'; end if;

  v_is_self := (v_caller_id = p_candidate_id);

  if p_target_role = 'admin' then
    if v_candidate_role <> 'user' then
      raise exception 'Usuário já possui cargo de staff';
    end if;
    if not v_is_self and role_rank(v_caller_role) < 2 then
      raise exception 'Acesso negado: apenas admins (ou o próprio usuário) podem indicar para admin';
    end if;
  else -- super_admin
    if v_is_self then
      raise exception 'Não é possível se autoindicar para super admin';
    end if;
    if role_rank(v_caller_role) < 3 then
      raise exception 'Acesso negado: apenas super admins ou o fundador podem indicar para super admin';
    end if;
    if v_candidate_role <> 'admin' then
      raise exception 'Candidato precisa já ser admin para ser indicado a super admin';
    end if;
  end if;

  if exists (
    select 1 from staff_nominations
    where candidate_id = p_candidate_id and status in ('pending','trial_active')
  ) then
    raise exception 'Já existe uma indicação em andamento para este usuário';
  end if;

  v_eligibility := check_staff_eligibility(p_candidate_id, p_target_role);
  if not (v_eligibility->>'eligible')::boolean then
    raise exception 'Candidato não atende aos critérios de elegibilidade no momento';
  end if;

  insert into staff_nominations (candidate_id, nominated_by, target_role, status, eligibility_snapshot)
  values (p_candidate_id, case when v_is_self then null else v_caller_id end, p_target_role, 'pending', v_eligibility)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function review_staff_nomination(p_nomination_id uuid, p_decision text, p_notes text default null, p_trial_days int default 45)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_id          uuid := auth.uid();
  v_caller_role        text;
  v_caller_username    text;
  v_nom                staff_nominations%rowtype;
  v_candidate_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then
    raise exception 'Acesso negado: apenas super admins ou o fundador podem analisar indicações';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Decisão inválida: %', p_decision;
  end if;
  if p_trial_days is null or p_trial_days < 1 then
    raise exception 'Duração do trial inválida';
  end if;

  select * into v_nom from staff_nominations where id = p_nomination_id for update;
  if v_nom.id is null then raise exception 'Indicação não encontrada'; end if;
  if v_nom.status <> 'pending' then raise exception 'Indicação já foi analisada'; end if;

  if v_nom.target_role = 'super_admin' and v_caller_role <> 'owner' then
    raise exception 'Acesso negado: indicações para super admin só podem ser decididas pelo fundador';
  end if;

  select username into v_candidate_username from profiles where id = v_nom.candidate_id;

  if p_decision = 'reject' then
    update staff_nominations
       set status = 'rejected', reviewed_by = v_caller_id, review_notes = p_notes, decided_at = now()
     where id = p_nomination_id;

    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_nomination_rejected',
      'Indicação de @'||v_candidate_username||' para '||v_nom.target_role||' rejeitada por @'||v_caller_username, 'admin', 'info');
    return;
  end if;

  update staff_nominations
     set status = 'trial_active',
         reviewed_by = v_caller_id,
         review_notes = p_notes,
         decided_at = now(),
         trial_started_at = now(),
         trial_review_date = now() + (p_trial_days || ' days')::interval
   where id = p_nomination_id;

  update profiles set role = v_nom.target_role, role_changed_at = now() where id = v_nom.candidate_id;

  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_nomination_approved',
    'Indicação de @'||v_candidate_username||' para '||v_nom.target_role||' aprovada por @'||v_caller_username||
    ' — período de avaliação de '||p_trial_days||' dias iniciado', 'admin', 'info');
end;
$$;
;
