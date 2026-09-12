-- ============================================================================
-- SEC-018 — o último da classe: `nominate_staff`, e aqui o conserto é DIFERENTE
-- ============================================================================
--
-- Terceira e última função encontrada pela varredura do SEC-016/017. O guard:
--
--     if v_caller_role <> 'super_admin' then
--       raise exception 'Acesso negado: apenas super admins podem indicar...';
--     end if;
--
-- Mesmo buraco: `NULL <> 'super_admin'` é NULL, o IF não dispara, e quem não
-- tem perfil cria uma indicação para **super admin**.
--
-- ── Por que aqui NÃO cabe `is_super()` ──────────────────────────────────────
--
-- Nas outras a troca por `is_super()` era certa porque o guard queria dizer
-- "super_admin **ou acima**". Aqui ele quer dizer **exatamente** super_admin, e
-- isso é desenho, não descuido: a própria mensagem explica que *"o fundador é o
-- avaliador independente dessas indicações"*. Trocar por `is_super()` deixaria
-- o owner indicar e depois avaliar a própria indicação — destruiria a separação
-- de papéis que a função existe para manter.
--
-- ── `IS DISTINCT FROM`, que é a ferramenta certa para "diferente, e NULL conta"
--
--     NULL <> 'super_admin'                --> NULL   (o IF não dispara)
--     NULL IS DISTINCT FROM 'super_admin'  --> true   (o IF dispara)
--
-- Preserva a semântica exata e fecha o NULL. É a regra geral para toda
-- comparação de desigualdade cujo lado esquerdo pode ser nulo.
--
-- ── Impacto, para não inflar ────────────────────────────────────────────────
--
-- 🔵 Baixo. A indicação sozinha **não promove ninguém**: ela nasce `pending` e
-- depende de `review_staff_nomination`, que abre com `role_rank < 3` e portanto
-- já era NULL-safe. O estrago possível era sujar a fila de indicações com um
-- item que a equipe teria de rejeitar. Está aqui porque é o mesmo padrão, e
-- corrigir pela CLASSE é a regra (§1.3) — deixar um dos três de fora é como as
-- 14 policies sem `owner` sobreviveram três rodadas.
--
-- O ramo de `admin`, logo acima no mesmo `if`, já estava certo: ele usa
-- `role_rank(v_caller_role) < 2`, e `role_rank(NULL)` é 0.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.nominate_staff(p_candidate_id uuid, p_target_role text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_caller_id     uuid := auth.uid();
  v_caller_role   text;
  v_candidate_role text;
  v_is_self       boolean;
  v_eligibility   jsonb;
  v_id            uuid;
begin
  if p_target_role is null or p_target_role not in ('admin','super_admin') then
    raise exception 'Cargo inválido: %', coalesce(p_target_role, '(vazio)');
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
    -- `IS DISTINCT FROM` e não `<>`: com `v_caller_role` NULL (chamador sem
    -- perfil), `<>` devolve NULL, o IF não dispara e o portão fica aberto.
    -- Mantém o sentido literal de propósito — o owner NÃO indica, ele avalia.
    if v_caller_role is distinct from 'super_admin' then
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
$fn$;
