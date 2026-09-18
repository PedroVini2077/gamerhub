-- SEC-032 · `[18/09]` O oraculo de existencia, agora pela CLASSE inteira.
--
-- ── O que aconteceu, e e falha minha ──────────────────────────────────────
--
-- A SEC-031 (ontem) moveu autorizacao para antes de validacao em
-- `apply_suspension` e `request_role_demotion`. Eu tratei como DOIS CASOS.
--
-- O §1.3 e explicito: *"ao achar um bug, perguntar sempre: onde MAIS esse
-- mesmo padrao existe?"*. Eu nao perguntei. Uma auditoria externa encontrou
-- `restore_post` no dia seguinte, e a varredura que eu deveria ter feito na
-- SEC-031 achou **mais tres** alem dessa.
--
-- E o `restore_post` e o caso mais constrangedor: eu escrevi a guarda dele
-- **no mesmo dia**, na migration 20260918023709, e pus o lookup antes da
-- autorizacao com as proprias maos.
--
-- ── A varredura, e a armadilha que ela tinha ──────────────────────────────
--
-- A consulta compara, dentro de cada funcao `SECURITY DEFINER` executavel por
-- `authenticated`, a POSICAO do primeiro RAISE de "nao encontrado" contra a do
-- primeiro teste de autorizacao.
--
-- A primeira versao acusou CINCO, e uma era `request_role_demotion` — que eu
-- tinha acabado de corrigir. O motivo: o comentario que EU escrevi na SEC-031
-- cita 'Usuário não encontrado' em prosa, e a busca leu comentario como codigo.
-- **8a vez que essa armadilha aparece neste projeto.** Por isso a consulta
-- passou a tirar os comentarios ANTES de medir posicao.
--
-- ── As quatro, provadas com papel `authenticated` real ────────────────────
--
--                        alvo que EXISTE              alvo que NAO existe
--   restore_post         'Apenas admins podem...'     'Post não encontrado'
--   soft_delete_post     'Sem permissão para...'      'Post não encontrado'
--   lift_suspension      'Access denied: admin...'    'Usuario nao encontrado'
--   nominate_staff       'Usuário já possui cargo'    'Usuário não encontrado'
--
-- **A `nominate_staff` e pior que oraculo de existencia:** ela devolve o CARGO
-- do alvo para quem nao pode indicar ninguem.
--
-- ── Duas formas de conserto, porque o problema tem duas formas ────────────
--
-- **Tres aceitam "autorizacao primeiro"** — a permissao de quem chama nao
-- depende do alvo, entao basta subir a checagem. O autorizado continua
-- recebendo a mensagem util ('Post não encontrado' para o admin), que era o
-- requisito explicito.
--
-- **`soft_delete_post` NAO aceita**, e isso importa: quem pode apagar depende
-- de QUEM E O DONO, e descobrir o dono exige o lookup. Nao da para autorizar
-- antes de olhar. A saida e unificar a mensagem — e essa decisao ja existe
-- neste projeto, escrita no `fetchPostById`:
--
--   "As duas causas sao indistinguiveis do lado do cliente por construcao, e e
--    assim que deve ser: dizer 'existe, mas voce nao pode ver' ja e vazar a
--    existencia."
--
-- ── Provado em ROLLBACK, os dois lados ────────────────────────────────────
--
--   ATAQUE: as 4 passaram a responder IGUAL para alvo que existe e que nao
--           existe. O oraculo morreu nas quatro.
--
--   CAMINHOS QUE NAO PODIAM QUEBRAR:
--     autor apaga o proprio post ........... ok, deleted_at gravado
--     owner restaura post de outro ......... ok, deleted_at limpo
--     admin ve 'Post não encontrado' ....... ok, a mensagem util sobreviveu

CREATE OR REPLACE FUNCTION public.restore_post(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_owner uuid; v_apagado timestamptz;
BEGIN
  -- AUTORIZACAO PRIMEIRO (SEC-032). Nao depende do post, entao nada justifica
  -- olhar o post antes.
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Apenas admins podem restaurar posts';
  END IF;
  SELECT user_id, deleted_at INTO v_owner, v_apagado FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF (SELECT auth.uid()) <> v_owner AND NOT can_moderate_content(v_owner) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este post';
  END IF;
  IF v_apagado IS NULL THEN
    RAISE EXCEPTION 'Este post não está apagado — não há o que restaurar.';
  END IF;
  UPDATE posts SET deleted_at = null WHERE id = p_post_id AND deleted_at IS NOT NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_owner uuid;
BEGIN
  -- Aqui a autorizacao DEPENDE do dono, entao o lookup tem que vir antes. O
  -- que se pode fazer e nao contar a diferenca: "nao existe" e "nao e seu"
  -- devolvem o mesmo texto. Mesma regra do `fetchPostById`.
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL
     OR ((SELECT auth.uid()) <> v_owner AND NOT can_moderate_content(v_owner)) THEN
    RAISE EXCEPTION 'Post não encontrado ou sem permissão para excluí-lo.';
  END IF;
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id AND deleted_at IS NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.lift_suspension(p_user_id uuid, p_note text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_caller_role text; v_caller_username text;
        v_target_role text; v_target_username text; v_estava timestamptz;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  -- AUTORIZACAO PRIMEIRO (SEC-032).
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;

  SELECT role, username, suspended_until INTO v_target_role, v_target_username, v_estava
    FROM profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN RAISE EXCEPTION 'Usuario nao encontrado'; END IF;

  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot lift suspension of equal or higher role';
  END IF;
  IF v_estava IS NULL OR v_estava <= now() THEN
    RAISE EXCEPTION 'Este usuario nao esta suspenso.';
  END IF;

  UPDATE profiles SET suspended_until = NULL WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_unsuspended',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username
      || coalesce(' — ' || p_note, ''),
    'security', auth.uid(), v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'era_ate', v_estava, 'nota', p_note),
    auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_unsuspended', 'Suspensão removida',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua suspensão foi removida. Você já pode publicar normalmente.');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.nominate_staff(p_candidate_id uuid, p_target_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_candidate_role text;
  v_is_self boolean; v_eligibility jsonb; v_id uuid;
begin
  if p_target_role is null or p_target_role not in ('admin','super_admin') then
    raise exception 'Cargo inválido: %', coalesce(p_target_role, '(vazio)');
  end if;

  select role into v_caller_role from profiles where id = v_caller_id;
  v_is_self := (v_caller_id = p_candidate_id);

  -- AUTORIZACAO PRIMEIRO (SEC-032), e SEM olhar o candidato. Antes, o cargo do
  -- alvo ('Usuário já possui cargo de staff') chegava a quem nao pode indicar
  -- ninguem — vazava mais do que existencia.
  if p_target_role = 'admin' then
    if not v_is_self and role_rank(v_caller_role) < 2 then
      raise exception 'Acesso negado: apenas admins (ou o próprio usuário) podem indicar para admin';
    end if;
  else
    if v_is_self then
      raise exception 'Não é possível se autoindicar para super admin';
    end if;
    -- `IS DISTINCT FROM` e nao `<>`: com v_caller_role NULL, `<>` devolve NULL,
    -- o IF nao dispara e o portao fica aberto.
    if v_caller_role is distinct from 'super_admin' then
      raise exception 'Acesso negado: apenas super admins podem indicar para super admin (o fundador é o avaliador independente dessas indicações)';
    end if;
  end if;

  -- So agora o candidato pode ser olhado: quem chegou aqui tem permissao.
  select role into v_candidate_role from profiles where id = p_candidate_id;
  if v_candidate_role is null then raise exception 'Usuário não encontrado'; end if;

  if p_target_role = 'admin' then
    if v_candidate_role <> 'user' then raise exception 'Usuário já possui cargo de staff'; end if;
  else
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
