-- SEC-032b · `[18/09]` A QUINTA funcao com o padrao, e quem a achou foi a
-- propria trava da SEC-032 — nao eu, e nao a auditoria externa.
--
-- ── Por que a varredura do banco nao a viu, e a do arquivo viu ────────────
--
-- A varredura em `pg_proc` filtrava por
-- `has_function_privilege('authenticated', oid, 'EXECUTE')`, e a
-- `admin_set_role` teve o EXECUTE revogado no SEC-026 (era porta morta: nenhum
-- chamador no frontend). Entao ela ficou de fora, com razao — hoje ninguem
-- consegue chama-la.
--
-- A trava de regressao le as MIGRATIONS, que nao sabem nada sobre grant. Ela
-- acusou. E ela esta certa: o §1.3 manda fechar "brecha que so vira problema
-- amanha", e reconceder um EXECUTE e uma linha de SQL que alguem escreve sem
-- lembrar deste detalhe. O codigo ficaria pronto para vazar de novo.
--
-- ── O que estava errado ───────────────────────────────────────────────────
--
--   select role, username into v_target_role, ... from profiles ...
--   if v_target_username is null then raise 'Usuário não encontrado'; end if;   <- 1o
--   if role_rank(v_caller_role) < 2 then raise 'Acesso negado'; end if;         <- 2o
--
-- Mesma inversao das outras quatro. Corrigida do mesmo jeito: a checagem de
-- cargo nao depende do alvo, entao ela sobe.
--
-- ── Duas camadas, nao uma ─────────────────────────────────────────────────
--
-- O REVOKE do SEC-026 continua sendo a protecao real — esta migration nao o
-- desfaz nem o enfraquece. Ela tira a ARMADILHA de dentro do codigo, para que
-- a protecao nao dependa de uma unica linha de grant que ninguem revisita.

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  -- AUTORIZACAO PRIMEIRO (SEC-032b). Nao depende do alvo.
  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;

  if p_new_role is null or p_new_role not in ('user','admin','super_admin') then
    raise exception 'Role inválida: %', coalesce(p_new_role, '(vazio)');
  end if;
  if p_user_id = v_caller_id then raise exception 'Não é possível alterar a própria role'; end if;

  select role, username into v_target_role, v_target_username from profiles where id = p_user_id;
  if v_target_username is null then raise exception 'Usuário não encontrado'; end if;

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
$fn$;
