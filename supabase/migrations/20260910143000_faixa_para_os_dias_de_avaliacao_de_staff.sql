-- ============================================================================
-- Faixa para os dias de avaliação de staff (SEC-008)
-- ============================================================================
--
-- O PROBLEMA
-- ----------
-- `review_staff_nomination(p_trial_days)` e `decide_staff_trial(p_extend_days)`
-- tinham PISO e nenhum TETO:
--
--     if p_trial_days is null or p_trial_days < 1 then raise ...
--
-- É a regra do BANCO.md — *"toda entrada de RPC precisa de FAIXA, não só de
-- tipo"* — e é a MESMA falha que em 2026 transformou uma suspensão de "alguns
-- dias" numa suspensão até o ano 2126.
--
-- Provado em ROLLBACK, aprovando uma indicação com 3.650.000 dias:
--
--     1_trial_absurdo  ACEITO — 3.650.000 dias
--     2_consequencia   cargo virou "admin" e a revisao ficou para 12020-01-20
--
-- POR QUE ISSO IMPORTA, sendo que quem chama já é super admin
-- -----------------------------------------------------------
-- Porque o trial é justamente o que autoriza um super admin a promover sem o
-- fundador. `owner_set_role` exige `owner`; este caminho aceita `role_rank >= 3`
-- **porque o cargo entra em avaliação**. Um trial que vence no ano 12020 é uma
-- promoção definitiva com outro nome.
--
-- E o vencimento não é cobrado por máquina nenhuma: não há cron sobre
-- `trial_review_date` — conferido em `cron.job`. Quem cobra é uma PESSOA vendo
-- o `TrialCard` do painel, que mostra `daysUntil(trial_review_date)`. Uma data
-- absurda tira o caso da frente dessa pessoa para sempre.
--
-- POR QUE NÃO DÁ PARA DIZER "MAS A TELA NÃO OFERECE ESSE NÚMERO"
-- --------------------------------------------------------------
-- O `roleNominationService.js` **nem envia** os dois parâmetros — usa os
-- defaults (45 e 15). Isso não protege nada: o site usa a `anon key`, e a REST
-- API aceita o parâmetro que o frontend nunca manda. É por isso que a faixa
-- precisa existir aqui, e não numa tela.
--
-- Efeito colateral bom: como nenhuma tela envia esses valores, a faixa não pode
-- quebrar nenhum caminho existente.
--
-- OS LIMITES SÃO DECISÃO DE PRODUTO, E ESTÃO ESCRITOS AQUI
-- --------------------------------------------------------
--   trial: 7 a 180 dias. Menos de uma semana não observa ninguém trabalhando;
--          mais de seis meses não é avaliação, é o cargo. Os defaults de hoje
--          (45 e 15) ficam folgados dentro da faixa.
--   extensão: 1 a 90 dias por vez, e o trial inteiro não passa de 365 dias
--          contados do início. O teto total fecha o "estender 90 mil vezes";
--          cada extensão continua sendo ação de `role_rank >= 3` e vai para o
--          `admin_logs`, então ela é visível — o que faltava era um fim.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.review_staff_nomination(
  p_nomination_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL::text,
  p_trial_days integer DEFAULT 45
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  -- FAIXA, não só tipo. `NULL < 7` é NULL em SQL e o IF não dispararia, por
  -- isso o `is null` explícito continua primeiro.
  if p_trial_days is null or p_trial_days < 7 or p_trial_days > 180 then
    raise exception 'Duração do período de avaliação inválida: use de 7 a 180 dias.';
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
$$;

CREATE OR REPLACE FUNCTION public.decide_staff_trial(
  p_nomination_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL::text,
  p_extend_days integer DEFAULT 15
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_nom staff_nominations%rowtype; v_candidate_username text; v_previous_role text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then
    raise exception 'Acesso negado: apenas super admins ou o fundador podem decidir sobre avaliações';
  end if;
  if p_decision not in ('confirm','extend','revert') then raise exception 'Decisão inválida: %', p_decision; end if;

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
    if p_extend_days is null or p_extend_days < 1 or p_extend_days > 90 then
      raise exception 'Extensão inválida: use de 1 a 90 dias.';
    end if;
    -- Teto do TOTAL. Sem ele, extensões repetidas reconstroem o problema que a
    -- faixa acima fecha — só que em parcelas.
    if v_nom.trial_review_date + (p_extend_days || ' days')::interval
       > coalesce(v_nom.trial_started_at, now()) + interval '365 days' then
      raise exception 'Extensão negada: o período de avaliação não pode passar de 365 dias no total. Confirme o cargo ou reverta.';
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

  -- revert: volta ao cargo que a pessoa tinha ANTES da promoção.
  -- `nominate_staff` garante o par: admin <- user, super_admin <- admin.
  v_previous_role := case when v_nom.target_role = 'super_admin' then 'admin' else 'user' end;

  update staff_nominations
     set status = 'reverted', final_decided_by = v_caller_id, final_decision_notes = p_notes, final_decided_at = now()
   where id = p_nomination_id;

  update profiles set role = v_previous_role, role_changed_at = now() where id = v_nom.candidate_id;

  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_reverted',
    'Avaliação de @'||v_candidate_username||' revertida por @'||v_caller_username||
    ' — cargo voltou para '||v_previous_role||coalesce('. Motivo: '||p_notes, ''), 'admin', 'warning');
end;
$$;
