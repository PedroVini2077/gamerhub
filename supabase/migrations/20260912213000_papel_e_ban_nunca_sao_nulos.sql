-- ============================================================================
-- SEC-017 — o mesmo buraco de NULL, uma camada acima: no PARÂMETRO
-- ============================================================================
--
-- O SEC-016 fechou `role NOT IN (...)` quando o papel do CHAMADOR é NULL. A
-- varredura de classe que veio junto encontrou a irmã: o mesmo `NOT IN`
-- validando o papel que o cliente MANDA.
--
--     IF p_new_role NOT IN ('user','admin','super_admin') THEN
--       RAISE EXCEPTION 'Role inválida: %', p_new_role;
--     END IF;
--     ...
--     UPDATE profiles SET role = p_new_role WHERE id = ...;
--
-- Com `p_new_role = NULL` o guard não dispara e o UPDATE grava NULL.
--
-- ── E o CHECK não segura, o que é o detalhe que engana ──────────────────────
--
--     CHECK (role = ANY (ARRAY['user','admin','super_admin','owner']))
--
-- Constraint só reprova em **false explícito**. `NULL = ANY(...)` é NULL, e
-- NULL não é false — então o CHECK **aprova**. Medido em ROLLBACK: o UPDATE
-- passou e o perfil ficou com `role` nulo.
--
-- ── O que um perfil de papel nulo é ─────────────────────────────────────────
--
-- `role_rank(NULL)` é 0 (medido) — **abaixo de `user`, que é 1**. É um estado
-- que nenhuma tela, policy ou função sabe que existe: não é equipe, não é
-- usuário comum, e não é anônimo. O `admin_set_role` chamado sobre um perfil
-- assim responde *"Usuário não encontrado"*, que é mensagem falsa (§1.5) —
-- manda procurar o usuário em vez do estado.
--
-- ── Quem alcança ────────────────────────────────────────────────────────────
--
-- 🟡 Médio. Só o `owner` chega no `owner_set_role`, então não é escalada de
-- privilégio: é um **pé de ferro** que o dono pode disparar sozinho pela REST
-- API, e cujo estrago (um perfil fora de toda a hierarquia) não tem tela que
-- mostre nem caminho óbvio de volta. O `admin_set_role` exige que o alvo
-- exista com papel não nulo, então ele já barrava antes.
--
-- Medido em produção antes de aplicar: **0 perfis com `role` nulo, 0 com
-- `banned` nulo**, em 5 perfis.
--
-- ── A trava é de NÍVEL 1 (§2): o dado errado vira IMPOSSÍVEL ────────────────
--
-- Podia ter sido só uma checagem de `IS NULL` dentro das duas funções — nível
-- 4 na tabela do §2, e a próxima RPC que escrevesse em `role` nasceria sem
-- ela. `NOT NULL` na coluna vale para todo caminho que existe **e para os que
-- ainda não existem**, que é a diferença entre travar a classe e travar o caso.
--
-- As duas colunas já têm DEFAULT (`'user'` e `false`), então nem o cadastro nem
-- nenhum INSERT existente precisa mudar — verificado em ROLLBACK: o trigger
-- `handle_new_user` continua criando o perfil com `role=user banned=false`.
-- ============================================================================

ALTER TABLE public.profiles ALTER COLUMN role   SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN banned SET NOT NULL;

COMMENT ON COLUMN public.profiles.role IS
  'Papel na hierarquia. NOT NULL de proposito: o CHECK aprova NULL (NULL = ANY(...) e NULL, nao false), e role_rank(NULL) e 0 — abaixo de user. Ver SEC-017.';
COMMENT ON COLUMN public.profiles.banned IS
  'NOT NULL de proposito: `IF NOT v_banned` nao dispara com NULL, e o guard de desbanimento passaria direto. Ver SEC-017.';


-- ── A mensagem, que a constraint sozinha não dá ─────────────────────────────
--
-- Com o `NOT NULL` acima, chamar com NULL já falha — mas falha com *"null value
-- in column role violates not-null constraint"*, que é o texto do Postgres
-- chegando no toast do painel. §1.5: toda mensagem de erro tem que ser
-- verdadeira E útil. A checagem explícita existe para a mensagem; a constraint
-- existe para os caminhos que ninguém escreveu ainda.
CREATE OR REPLACE FUNCTION public.owner_set_role(p_target_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_owner_username TEXT; v_target_username TEXT; v_old_role TEXT;
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Acesso negado — apenas o fundador pode alterar roles.';
  END IF;
  IF p_target_user_id = auth.uid() THEN RAISE EXCEPTION 'Não é possível alterar a própria role.'; END IF;

  -- `IS NULL` ANTES do `NOT IN`: `NULL NOT IN (...)` é NULL e não dispara.
  IF p_new_role IS NULL OR p_new_role NOT IN ('user','admin','super_admin') THEN
    RAISE EXCEPTION 'Role inválida: %', COALESCE(p_new_role, '(vazio)');
  END IF;

  SELECT username, role INTO v_target_username, v_old_role FROM profiles WHERE id = p_target_user_id;
  -- Faltava: sem alvo o UPDATE afeta 0 linhas, e a trilha ganhava
  -- "Role de @? alterada de ? para admin pelo fundador" (§1.5).
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
  IF v_old_role = 'owner' THEN
    RAISE EXCEPTION 'Não é possível alterar a role do fundador.';
  END IF;

  SELECT username INTO v_owner_username FROM profiles WHERE id = auth.uid();

  UPDATE profiles SET role = p_new_role, role_changed_at = now() WHERE id = p_target_user_id;

  INSERT INTO admin_logs (admin_id, admin_username, actor_id, actor_username,
                          action, details, category, severity, metadata)
  VALUES (auth.uid(), v_owner_username, auth.uid(), v_owner_username, 'set_role',
    'Role de @' || v_target_username || ' alterada de ' ||
      v_old_role || ' para ' || p_new_role || ' pelo fundador',
    'admin', 'info',
    jsonb_build_object('target_id', p_target_user_id, 'target_username', v_target_username,
                       'from_role', v_old_role, 'to_role', p_new_role));
END;
$fn$;


CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  select role, username into v_target_role, v_target_username from profiles where id = p_user_id;
  if v_target_username is null then raise exception 'Usuário não encontrado'; end if;
  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;
  if p_user_id = v_caller_id then raise exception 'Não é possível alterar a própria role'; end if;
  -- `IS NULL` antes do `NOT IN`, mesmo motivo do `owner_set_role`.
  if p_new_role is null or p_new_role not in ('user','admin','super_admin') then
    raise exception 'Role inválida: %', coalesce(p_new_role, '(vazio)');
  end if;
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


-- ── `IS NOT TRUE` em vez de `NOT`, e isto é um conserto do SEC-016 ──────────
--
-- Eu escrevi `IF NOT v_target_banned THEN RAISE` na migration anterior, hoje
-- mesmo, e caí na regra que estava fechando: com `banned` NULL, `NOT NULL` é
-- NULL, o IF não dispara, e o desbanimento seguiria em frente.
--
-- O `NOT NULL` acima já torna isso impossível pelo dado. Isto aqui é a segunda
-- camada, para o dia em que alguém afrouxar a coluna — que é exatamente como o
-- SEC-016 estava "protegido" antes: por uma constraint que não sabia que estava
-- fazendo controle de acesso.
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_caller_username text;
  v_target_username text;
  v_target_banned   boolean;
BEGIN
  IF NOT is_super() THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;

  SELECT username INTO v_caller_username FROM profiles WHERE id = v_caller_id;

  SELECT username, banned INTO v_target_username, v_target_banned
    FROM profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;
  IF v_target_banned IS NOT TRUE THEN
    RAISE EXCEPTION 'Este usuario nao esta banido.';
  END IF;

  IF p_note IS NOT NULL AND length(p_note) > 500 THEN
    RAISE EXCEPTION 'A nota da equipe deve ter no maximo 500 caracteres.';
  END IF;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = p_user_id;

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'unban',
    'Seu banimento foi revisto e removido. Sua conta voltou ao normal.'
      || COALESCE(' Nota da equipe: ' || p_note, ''));

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban',
    '@' || v_target_username || ' foi desbanido por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$fn$;
