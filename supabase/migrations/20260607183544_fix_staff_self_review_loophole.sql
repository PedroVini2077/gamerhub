-- 1) nominate_staff: indicações para super_admin agora exigem caller com role = 'super_admin'
--    (antes role_rank >= 3 também permitia o owner, que é o avaliador exclusivo dessas indicações,
--     criando um caminho onde a mesma pessoa indica E decide)
CREATE OR REPLACE FUNCTION public.nominate_staff(p_candidate_id uuid, p_target_role text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if v_caller_role <> 'super_admin' then
      raise exception 'Acesso negado: apenas super admins podem indicar para super admin (o fundador é o avaliador independente dessas indicações)';
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
$function$;

-- 2) review_staff_nomination: bloqueia o indicador de analisar a própria indicação
CREATE OR REPLACE FUNCTION public.review_staff_nomination(p_nomination_id uuid, p_decision text, p_notes text DEFAULT NULL::text, p_trial_days integer DEFAULT 45)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_nom.nominated_by is not null and v_nom.nominated_by = v_caller_id then
    raise exception 'Acesso negado: você não pode analisar uma indicação que você mesmo fez';
  end if;

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
$function$;

-- 3) decide_staff_trial: bloqueia o indicador de decidir sobre o resultado da própria indicação
CREATE OR REPLACE FUNCTION public.decide_staff_trial(p_nomination_id uuid, p_decision text, p_notes text DEFAULT NULL::text, p_extend_days integer DEFAULT 15)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_nom.nominated_by is not null and v_nom.nominated_by = v_caller_id then
    raise exception 'Acesso negado: você não pode decidir sobre uma avaliação que você mesmo indicou';
  end if;

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
$function$;

-- 4) decide_role_demotion: bloqueia quem solicitou o rebaixamento de decidir sobre ele mesmo
CREATE OR REPLACE FUNCTION public.decide_role_demotion(p_request_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if v_req.requested_by = v_caller_id then
    raise exception 'Acesso negado: você não pode decidir uma solicitação de rebaixamento que você mesmo fez';
  end if;

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
$function$;

-- 5) Rede de segurança contra condição de corrida: impede duplicidade de indicações/solicitações
--    em andamento para o mesmo alvo a nível de banco (antes só havia checagem EXISTS na aplicação)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_nominations_active_candidate
  ON staff_nominations (candidate_id)
  WHERE status IN ('pending','trial_active');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_role_change_requests_pending_target
  ON role_change_requests (target_id)
  WHERE status = 'pending';
;
