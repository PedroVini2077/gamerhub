-- ─────────────────────────────────────────────────────────────────────────────
-- Três mudanças que são a mesma história: o cadastro precisava do `SELECT` de
-- `anon` em `profiles`, e um `UPDATE` que nunca funcionou.
--
-- ── 1. O bug que estava vivo, e é o mais grave ──────────────────────────────
--
-- `useAuth.jsx` gravava `birth_date`, `state` e `platform` com um `UPDATE`
-- feito LOGO DEPOIS do `signUp`. Com confirmação de e-mail ligada, o `signUp`
-- não devolve sessão — então aquele `UPDATE` roda como **`anon`**, e a única
-- policy de UPDATE de `profiles` é `TO authenticated`.
--
-- Resultado, medido em ROLLBACK: **0 linhas afetadas e NENHUM erro**. O código
-- checava `error`, que vinha nulo, e seguia em frente. Os três campos eram
-- descartados em silêncio em todo cadastro — é o §1.5 e o §4 juntos
-- ("`count: 'exact'` + tratar 0 linhas como erro"), na porta de entrada do site.
--
-- **A consequência que importa:** `birth_date` nunca chegava ao banco, e o
-- trigger `guard_idade_minima` dispara em `INSERT OR UPDATE OF birth_date`.
-- Sem o valor, ele nunca disparava — a idade mínima de 13 anos existia no
-- formulário, no banco e na política de privacidade, e **não era imposta em
-- lugar nenhum**. Evidência: 3 dos 5 perfis com `birth_date` nulo.
--
-- O conserto é escrever os campos no INSERT do perfil, dentro do trigger que
-- já roda como `SECURITY DEFINER` — sem RLS no caminho, e com a validação de
-- idade disparando de verdade. Confirmado em ROLLBACK: menor de 13 é barrado
-- com a mensagem em português.
--
-- Data inválida **estoura** em vez de virar nulo: cair para nulo seria
-- justamente o buraco que esta migration fecha (§4, fallback silencioso).
-- `role` continua literal `'user'` — nada vindo do metadata do usuário decide
-- cargo.
--
-- ── 2. `username_disponivel`, para o cadastro parar de precisar de SELECT ───
--
-- A checagem de username duplicado fazia `select('id').eq('username', …)`, e
-- era o único motivo de `anon` ter `SELECT (id, username)` em `profiles`.
-- Só que o PostgREST não obriga a filtrar: `select=id,username` devolvia as 5
-- linhas, e somado a `site_config.updated_by` isso ligava um UUID de staff a
-- um nome.
--
-- Uma RPC devolvendo booleano responde a pergunta do cadastro sem entregar a
-- lista. É o mesmo padrão de `get_public_profile` e `admin_list_users`: RLS é
-- por linha e privilégio é por coluna — "responda só ISTO sobre UMA linha" não
-- se expressa com nenhum dos dois.
--
-- **O que ela NÃO resolve, dito antes que alguém confie demais:** ainda dá para
-- perguntar um nome por vez e descobrir quais existem. Isso é inerente a
-- qualquer cadastro que diga "username já em uso" — o ganho real é acabar com
-- a listagem em massa e com o UUID.
--
-- `lower()` nos dois lados: sem isso `CLAUDETESTER` passaria como livre e o
-- cadastro quebraria depois, no índice único.
--
-- ── 3. O revoke, que só é seguro por causa dos dois acima ───────────────────
--
-- Este é o quarto revoke de coluna deste projeto, e os três primeiros
-- derrubaram o site (POSTURA.md). A diferença aqui é que quem lia foi
-- procurado ANTES, e no lugar certo: não era policy nem função, era o
-- **cliente**. Os dois leitores encontrados foram tratados — o do cadastro
-- virou RPC, e o do `UPDATE` nunca funcionou.
--
-- `fetchSiteStats` também conta `profiles`, mas só é chamada de `Sidebar` e
-- `RightPanel`, que existem apenas dentro do Layout logado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.username_disponivel(p_username text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' STABLE
AS $fn$
DECLARE v text := lower(btrim(coalesce(p_username, '')));
BEGIN
  -- Faixa, e não só tipo (§5). A mesma regra do `USERNAME_REGEX` do cliente:
  -- as duas precisam concordar, e um teste de contrato confere isso.
  IF v !~ '^[a-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Username: 3 a 20 caracteres, apenas letras minusculas, numeros e _';
  END IF;
  RETURN NOT EXISTS (SELECT 1 FROM profiles WHERE lower(username) = v);
END $fn$;

COMMENT ON FUNCTION public.username_disponivel(text) IS
  'Diz se um username esta livre, sem entregar a lista de perfis. Existe para o '
  'cadastro nao precisar de SELECT em profiles como anon.';

REVOKE ALL ON FUNCTION public.username_disponivel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_disponivel(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_nasc  date;
  v_bruto text := NEW.raw_user_meta_data->>'birth_date';
BEGIN
  IF v_bruto IS NOT NULL AND btrim(v_bruto) <> '' THEN
    BEGIN
      v_nasc := v_bruto::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Data de nascimento invalida: %', v_bruto;
    END;
  END IF;

  INSERT INTO public.profiles (id, username, role, birth_date, state, platform)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user',
    v_nasc,
    left(nullif(btrim(coalesce(NEW.raw_user_meta_data->>'state','')), ''), 2),
    left(nullif(btrim(coalesce(NEW.raw_user_meta_data->>'platform','')), ''), 20)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $fn$;

REVOKE SELECT (id, username) ON public.profiles FROM anon;
