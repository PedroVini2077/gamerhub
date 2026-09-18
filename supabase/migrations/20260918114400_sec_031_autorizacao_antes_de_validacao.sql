-- SEC-031 · `[18/09]` Quem NAO pode chamar descobre isso ANTES de qualquer
-- outra coisa. Achado 15 do pentest — e um oraculo que ele nao achou.
--
-- ── O pedido era explicito, e ele muda a forma do conserto ───────────────
--
-- *"Nao mude simplesmente todas as mensagens sem avaliar o impacto."* De acordo:
-- **nenhuma mensagem muda aqui**. O que muda e a ORDEM. Quem tem permissao
-- continua recebendo exatamente os mesmos textos, na mesma situacao — inclusive
-- 'Suspensao deve ser de 1 a 30 dias', que e util e chega no toast do admin.
--
-- ── `apply_suspension` — o caso que o pentest trouxe ─────────────────────
--
-- A faixa de `p_days` era validada antes de 'Access denied: admin required'.
-- Um usuario comum chamando com `p_days = 99` recebia a regra de negocio em vez
-- da negativa. Vaza pouco (a regra dos 30 dias nao e segredo) — 🔵 Baixo —, mas
-- e sintoma de uma ordem errada, e ordem errada em funcao de moderacao e o tipo
-- de coisa que envelhece mal.
--
-- ── `request_role_demotion` — o oraculo LIMPO, que o pentest NAO viu ─────
--
-- Este e mais serio que o anterior e nao estava no relatorio. A funcao fazia:
--
--   if v_target_role is null then raise 'Usuário não encontrado'; end if;
--   if role_rank(v_caller_role) < 2 then raise 'Acesso negado: admin necessário';
--
-- Ou seja: **qualquer pessoa logada** distinguia uuid que existe de uuid que nao
-- existe, por dois textos diferentes. Um laco em cima disso enumera contas.
--
-- Vale comparar com o achado 14, avaliado como NAO-vulneravel: la o
-- `get_user_xp` devolve `0` tanto para conta real sem atividade quanto para uuid
-- inexistente, entao a resposta nao distingue — o oraculo nao existe de fato.
-- Aqui ele existe, e e limpo. A diferenca entre os dois e exatamente o que o
-- pedido queria que fosse avaliado caso a caso em vez de marcado no atacado.
--
-- ── A regra que fica ────────────────────────────────────────────────────
--
-- Autorizacao primeiro. Sempre. Validar entrada antes de saber se a pessoa pode
-- chamar e responder uma pergunta que nao foi autorizada a fazer.
--
-- Provado em ROLLBACK com papel de usuario comum, DEPOIS da correcao:
--   apply_suspension(alvo, 99) ............. 'Access denied: admin required'
--   request_role_demotion(alvo que EXISTE) . 'Acesso negado: admin necessário'
--   request_role_demotion(uuid inexistente)  'Acesso negado: admin necessário'
-- As duas ultimas passaram a ser IDENTICAS — o oraculo morreu.

CREATE OR REPLACE FUNCTION public.apply_suspension(p_user_id uuid, p_days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_caller_role text; v_caller_username text; v_target_role text; v_target_username text;
  v_until timestamptz;
BEGIN
  -- AUTORIZACAO PRIMEIRO (SEC-031). Antes, a faixa de dias era conferida aqui
  -- em cima e um usuario comum recebia a regra de negocio em vez da negativa.
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;

  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot suspend equal or higher role';
  END IF;

  -- Sem teto, `p_days` gigante virava banimento permanente sem passar pelo ban.
  -- `IS NULL` explicito porque `NULL < 1` e NULL e o IF nao dispararia.
  IF p_days IS NULL OR p_days < 1 OR p_days > 30 THEN
    RAISE EXCEPTION 'Suspensao deve ser de 1 a 30 dias. Para mais que isso, use banimento.';
  END IF;
  v_until := now() + (p_days || ' days')::interval;

  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_suspended', '@' || v_target_username || ' suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'security', auth.uid(), v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'days', p_days, 'until', v_until), auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_suspended', 'Usuário suspenso',
    '@' || v_target_username || ' foi suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username, 'days', p_days));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa por ' || p_days || ' dia(s). Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.request_role_demotion(p_target_id uuid, p_proposed_role text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_target_role text; v_id uuid;
begin
  -- AUTORIZACAO PRIMEIRO (SEC-031). Antes, 'Usuário não encontrado' vinha ANTES
  -- desta linha, e qualquer pessoa logada enumerava contas pela diferenca entre
  -- as duas mensagens.
  select role into v_caller_role from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;

  select role into v_target_role from profiles where id = p_target_id;
  if v_target_role is null then raise exception 'Usuário não encontrado'; end if;

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
$fn$;
