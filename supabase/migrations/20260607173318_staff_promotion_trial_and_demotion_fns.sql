create or replace function decide_staff_trial(p_nomination_id uuid, p_decision text, p_notes text default null, p_extend_days int default 15)
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
    raise exception 'Acesso negado: apenas super admins ou o fundador podem decidir sobre avaliações';
  end if;
  if p_decision not in ('confirm','extend','revert') then
    raise exception 'Decisão inválida: %', p_decision;
  end if;

  select * into v_nom from staff_nominations where id = p_nomination_id for update;
  if v_nom.id is null then raise exception 'Avaliação não encontrada'; end if;
  if v_nom.status <> 'trial_active' then raise exception 'Esta indicação não está em período de avaliação'; end if;

  if v_nom.target_role = 'super_admin' and v_caller_role <> 'owner' then
    raise exception 'Acesso negado: avaliação de super admin só pode ser decidida pelo fundador';
  end if;

  select username into v_candidate_username from profiles where id = v_nom.candidate_id;

  if p_decision = 'extend' then
    if p_extend_days is null or p_extend_days < 1 then
      raise exception 'Extensão inválida';
    end if;
    update staff_nominations
       set trial_review_date = trial_review_date + (p_extend_days || ' days')::interval,
           review_notes = coalesce(review_notes || E'\n', '') || '[Extensão +'||p_extend_days||'d por @'||v_caller_username||'] ' || coalesce(p_notes, '')
     where id = p_nomination_id;

    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_extended',
      'Avaliação de @'||v_candidate_username||' estendida em '||p_extend_days||' dias por @'||v_caller_username, 'admin', 'info');
    return;
  end if;

  if p_decision = 'confirm' then
    update staff_nominations
       set status = 'confirmed', final_decided_by = v_caller_id, final_decision_notes = p_notes, final_decided_at = now()
     where id = p_nomination_id;

    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_confirmed',
      'Avaliação de @'||v_candidate_username||' confirmada — cargo de '||v_nom.target_role||' efetivado por @'||v_caller_username, 'admin', 'info');
    return;
  end if;

  -- revert
  update staff_nominations
     set status = 'reverted', final_decided_by = v_caller_id, final_decision_notes = p_notes, final_decided_at = now()
   where id = p_nomination_id;

  update profiles set role = 'user', role_changed_at = now() where id = v_nom.candidate_id;

  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_reverted',
    'Avaliação de @'||v_candidate_username||' revertida — cargo removido por @'||v_caller_username||
    coalesce('. Motivo: '||p_notes, ''), 'admin', 'warning');
end;
$$;

create or replace function request_role_demotion(p_target_id uuid, p_proposed_role text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_id          uuid;
begin
  select role into v_caller_role from profiles where id = v_caller_id;
  select role into v_target_role from profiles where id = p_target_id;
  if v_target_role is null then raise exception 'Usuário não encontrado'; end if;

  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;
  if p_target_id = v_caller_id then raise exception 'Não é possível solicitar rebaixamento da própria conta'; end if;
  if v_target_role = 'owner' then raise exception 'Não é possível alterar a role do fundador'; end if;
  if p_proposed_role not in ('user','admin') then raise exception 'Cargo proposto inválido: %', p_proposed_role; end if;
  if role_rank(p_proposed_role) >= role_rank(v_target_role) then
    raise exception 'O cargo proposto precisa ser inferior ao cargo atual';
  end if;
  if role_rank(v_caller_role) <= role_rank(v_target_role) then
    raise exception 'Acesso negado: cargo igual ou superior ao do alvo';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'É necessário informar um motivo (mínimo 10 caracteres)';
  end if;
  if exists (select 1 from role_change_requests where target_id = p_target_id and status = 'pending') then
    raise exception 'Já existe uma solicitação de rebaixamento pendente para este usuário';
  end if;

  insert into role_change_requests (target_id, requested_by, previous_role, proposed_role, reason, status)
  values (p_target_id, v_caller_id, v_target_role, p_proposed_role, trim(p_reason), 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function decide_role_demotion(p_request_id uuid, p_decision text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller_id        uuid := auth.uid();
  v_caller_role      text;
  v_caller_username  text;
  v_req              role_change_requests%rowtype;
  v_target_username  text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then
    raise exception 'Acesso negado: apenas super admins ou o fundador podem decidir rebaixamentos';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Decisão inválida: %', p_decision; end if;

  select * into v_req from role_change_requests where id = p_request_id for update;
  if v_req.id is null then raise exception 'Solicitação não encontrada'; end if;
  if v_req.status <> 'pending' then raise exception 'Solicitação já foi analisada'; end if;

  select username into v_target_username from profiles where id = v_req.target_id;

  if p_decision = 'reject' then
    update role_change_requests
       set status = 'rejected', reviewed_by = v_caller_id, review_notes = p_notes, decided_at = now()
     where id = p_request_id;

    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'demotion_rejected',
      'Solicitação de rebaixamento de @'||v_target_username||' rejeitada por @'||v_caller_username, 'admin', 'info');
    return;
  end if;

  update role_change_requests
     set status = 'approved', reviewed_by = v_caller_id, review_notes = p_notes, decided_at = now()
   where id = p_request_id;

  update profiles set role = v_req.proposed_role, role_changed_at = now() where id = v_req.target_id;

  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'demotion_approved',
    'Rebaixamento de @'||v_target_username||' de '||v_req.previous_role||' para '||v_req.proposed_role||
    ' aprovado por @'||v_caller_username||'. Motivo original: '||v_req.reason, 'admin', 'warning');
end;
$$;
;
