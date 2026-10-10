-- ============================================================================
-- As CONQUISTAS ganham REGISTRO de desbloqueio — e nenhum gatilho.
--
-- ── O que isto é, e o que explicitamente NÃO é ──────────────────────────────
--
-- `src/lib/conquistas.js` recusou a tabela em 05/09, e a recusa continua certa
-- para o desenho que ela recusou: `achievements` + `user_achievements` com
-- TRIGGER em `posts`, `post_likes` e `comments`. Aquilo e uma escrita por
-- interacao de todo mundo — a conta que multiplica por usuarios x posts x
-- leitores, que e o §0.2 na veia.
--
-- Este desenho nao tem gatilho nenhum. A escrita acontece uma vez por
-- conquista, por pessoa, PARA SEMPRE: no maximo 8 linhas por conta na vida
-- inteira, gravadas quando ela abre o PROPRIO perfil e algo novo cruzou a meta.
-- Depois disso, abrir o perfil nao escreve mais nada (`ON CONFLICT DO NOTHING`
-- sobre a chave primaria).
--
-- ── Por que o SERVIDOR mede, e o cliente nao pode dizer "desbloqueei" ───────
--
-- O site usa a `anon key` (§1.3). Uma RPC que aceitasse `p_conquista_id` do
-- cliente daria a qualquer pessoa logada todas as conquistas por um `POST` no
-- `/rest/v1/rpc/`. Entao a funcao nao recebe parametro nenhum: ela mede, do
-- zero, a partir da `xp_dos_usuarios` e de `profiles`, para `auth.uid()`.
--
-- O preco disso e que as METAS passam a existir em DOIS lugares — aqui e no
-- `CONQUISTAS` do JS. Isso e deriva por construcao (FASE 4 do §6), e a resposta
-- do projeto para deriva e trava de contrato, nao confianca:
-- `conquistaNaoDerivaDoBanco.test.js` compara os dois conjuntos `id -> meta`
-- nos dois sentidos.
--
-- ── O BACKFILL, e por que ele NAO e opcional ────────────────────────────────
--
-- Sem ele, quem ja tem sete conquistas receberia a data de HOJE nas sete, no
-- primeiro acesso depois do deploy. Uma data que se apresenta como historia e
-- nao e vale menos do que data nenhuma (§1.1) — e, pior, nada acusaria.
--
-- Varrendo a base de uma vez com `retroativa = true`, todo registro gravado
-- DEPOIS tem data verdadeira, e a RPC nunca precisa decidir se e o primeiro
-- registro daquela conta. A alternativa — a RPC adivinhar "e a primeira vez?"
-- olhando se a tabela esta vazia para o usuario — erra justamente no caso novo:
-- uma conta criada hoje, que publica o 1o post amanha, teria a tabela vazia e
-- marcaria retroativa uma conquista de data conhecida.
-- ============================================================================

-- (continuacao: as funcoes e o backfill. A tabela esta na migration
--  `conquistas_desbloqueadas_tabela`, do mesmo instante.)

-- ── A medicao, num lugar so ─────────────────────────────────────────────────
--
-- Funcao de LEITURA, usada pela RPC e pelos testes. Devolve uma linha por
-- conquista com o valor medido e a meta — a comparacao com a meta acontece
-- num lugar unico, exatamente como no JS (`avaliarConquistas`), para duas
-- conquistas nao discordarem sobre o que e "concluida".
--
-- `STABLE` e nao `IMMUTABLE`: ela le tabelas.

CREATE OR REPLACE FUNCTION public.medir_conquistas(p_user_id uuid)
RETURNS TABLE (conquista_id text, valor integer, meta integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH x AS (
    SELECT v.posts, v.lives, v.likes, v.comentarios
      FROM xp_dos_usuarios v WHERE v.user_id = p_user_id
  ), p AS (
    SELECT
      -- Os MESMOS seis campos que a `get_user_xp` paga em `profile_bonus`, e
      -- medidos com a MESMA funcao (`texto_visivel`). O JS usa `trim()`, que
      -- so corta espaco ASCII: um perfil de U+200B contaria como preenchido
      -- la e nao aqui. O servidor e a autoridade — ver SEC/`xpSoPagaOQueAparece`.
        texto_visivel(pr.bio)::int      + texto_visivel(pr.avatar_url)::int
      + texto_visivel(pr.platform)::int + texto_visivel(pr.discord)::int
      + texto_visivel(pr.twitch)::int   + texto_visivel(pr.youtube)::int
        AS campos_preenchidos,
      GREATEST(0, floor(EXTRACT(epoch FROM (now() - pr.created_at)) / 86400)::int)
        AS dias_de_casa
    FROM profiles pr WHERE pr.id = p_user_id
  )
  -- Mapa FECHADO e escrito por extenso. `VALUES` em vez de laco sobre uma
  -- tabela de definicoes de proposito: a lista precisa ser LEGIVEL pela trava
  -- que a compara com o JS, e tabela de configuracao seria um terceiro lugar
  -- para a mesma verdade (§4).
  SELECT c.id, c.valor, c.meta FROM (VALUES
    ('primeiro_post',           COALESCE((SELECT posts       FROM x), 0),  1),
    ('dez_posts',               COALESCE((SELECT posts       FROM x), 0), 10),
    ('primeira_live',           COALESCE((SELECT lives       FROM x), 0),  1),
    ('primeira_curtida',        COALESCE((SELECT likes       FROM x), 0),  1),
    ('vinte_e_cinco_curtidas',  COALESCE((SELECT likes       FROM x), 0), 25),
    ('dez_comentarios',         COALESCE((SELECT comentarios FROM x), 0), 10),
    ('perfil_completo',         COALESCE((SELECT campos_preenchidos FROM p), 0), 6),
    ('um_mes_de_casa',          COALESCE((SELECT dias_de_casa       FROM p), 0), 30)
  ) AS c(id, valor, meta);
$fn$;

COMMENT ON FUNCTION public.medir_conquistas(uuid) IS
  'Mede as 8 conquistas no SERVIDOR. A lista de id/meta e espelhada em '
  'src/lib/conquistas.js e a deriva e travada por conquistaNaoDerivaDoBanco.test.js.';

-- Ela e `SECURITY DEFINER` porque le `profiles` de um terceiro (o backfill
-- varre a base) — e por isso NAO recebe `anon` nem e exposta ao cliente: quem
-- a chama e a RPC abaixo e o backfill. Sem revoke, ela seria um oraculo que
-- diz quantas curtidas qualquer pessoa tem.
REVOKE ALL ON FUNCTION public.medir_conquistas(uuid) FROM PUBLIC, anon, authenticated;

-- ── A RPC que o cliente chama ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registrar_conquistas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_novas  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Precisa estar logado para registrar conquistas.';
  END IF;

  -- Sem parametro NENHUM, e e isso que fecha a brecha: nao ha o que forjar.
  -- A medicao sai do banco, para `auth.uid()`, sempre.
  WITH novas AS (
    INSERT INTO conquistas_desbloqueadas (user_id, conquista_id, retroativa)
    SELECT v_uid, m.conquista_id, false
      FROM medir_conquistas(v_uid) m
     WHERE m.valor >= m.meta
    ON CONFLICT (user_id, conquista_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_novas FROM novas;

  RETURN v_novas;
END;
$fn$;

COMMENT ON FUNCTION public.registrar_conquistas() IS
  'Registra o que a pessoa logada cumpriu e ainda nao tinha registro. Sem '
  'parametro de proposito: o cliente usa a anon key e nao pode nomear conquista. '
  'Devolve QUANTAS entraram — 0 e o caso normal depois da primeira vez.';

REVOKE ALL ON FUNCTION public.registrar_conquistas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_conquistas() TO authenticated;

-- O retorno e o §1.5: a RPC e chamada sem bloquear a tela, entao o numero de
-- novas linhas e o unico jeito de alguem que esteja testando distinguir
-- "funcionou e nao havia nada novo" de "nao funcionou". 0 e resposta, nao
-- silencio.

-- ── O BACKFILL — uma vez, e com a data marcada como desconhecida ────────────

INSERT INTO public.conquistas_desbloqueadas (user_id, conquista_id, retroativa)
SELECT pr.id, m.conquista_id, true
  FROM public.profiles pr
 CROSS JOIN LATERAL public.medir_conquistas(pr.id) m
 WHERE m.valor >= m.meta
ON CONFLICT (user_id, conquista_id) DO NOTHING;
