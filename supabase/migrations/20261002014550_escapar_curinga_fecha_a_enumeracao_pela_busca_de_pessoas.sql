-- `[02/10]` SEC-055 — a BUSCA DE PESSOAS entregava a base inteira, com cargos.
--
-- O ACHADO, e ele nasceu de uma regra nova
--
-- Ontem a Fase 3 do radar precisou escapar `%` e `_` num `ILIKE` porque os
-- termos vinham do modelo. Ao escrever isso como regra em `docs/regras/BANCO.md`
-- (faixa de entrada de RPC), a varredura da CLASSE — "onde mais este padrao
-- existe?", §1.3 — achou `buscar_pessoas`:
--
--     AND pr.username ILIKE '%' || v_termo || '%'      -- v_termo CRU
--
-- Ela e SECURITY DEFINER e `authenticated` executa. Medido em producao,
-- assumindo o papel de um usuario comum:
--
--     buscar_pessoas('%%', 50)  ->  6 perfis, a BASE INTEIRA:
--        claudestaff:admin · claudetester:user · ogamerhub:super_admin
--        ogamerpedro:user  · opedrovini:owner  · ovinipedro:admin
--
-- IMPACTO: enumeracao (§1.3 a nomeia). Qualquer pessoa com conta digita `%%`
-- na busca e recebe o cadastro completo — e, junto, a coluna `role`, que e o
-- mapa de quem atacar. Nao da poder nenhum sozinho; e o passo de
-- reconhecimento que vem antes de todos os outros. SEVERIDADE: ALTO (laranja
-- na escala do §1.3 — explorAvel por quem tem conta).
--
-- NAO E INJECAO DE SQL, e confundir leva ao conserto errado. `v_termo` e
-- parametro: o Postgres nunca o executa como codigo, e `quote_literal` nao
-- resolveria nada. O estrago e outro — o CORINGA do operador de padrao.
--
-- A BARRA PRIMEIRO, e isso o radar de ontem errou
--
-- O escape que eu escrevi ontem fazia `%` e `_` e parava ali. Um termo
-- terminado em `\` deixa o padrao terminando em caractere de escape, e o
-- Postgres LEVANTA ERRO na cara de quem buscou. Aqui a barra e escapada
-- primeiro, e `news_aceleracao_de_termos` passa a usar a mesma funcao —
-- UMA copia, porque duas divergem (§4).

CREATE OR REPLACE FUNCTION public.escapar_curinga(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = public
AS $fn$
  -- A ordem importa: a barra primeiro, senao as barras que ESTE replace
  -- introduz seriam escapadas de novo pelos seguintes.
  SELECT replace(replace(replace($1, '\', '\\'), '%', '\%'), '_', '\_');
$fn$;

-- Ninguem chama de fora: ela so serve de dentro das RPCs, que sao DEFINER e
-- rodam com o privilegio do dono. Regua de papeis do `docs/regras/BANCO.md`.
REVOKE ALL ON FUNCTION public.escapar_curinga(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.escapar_curinga(text) IS
  'Escapa \, % e _ para uso em ILIKE/LIKE. Nao e protecao contra injecao (o '
  'valor e parametro): e contra o CORINGA — um % solto casa com a tabela '
  'inteira e devolve resultado absurdo com cara de medicao. SEC-055.';

CREATE OR REPLACE FUNCTION public.buscar_pessoas(p_termo text, p_limite integer DEFAULT 20)
 RETURNS TABLE(id uuid, username text, avatar_url text, role text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_termo  text := btrim(coalesce(p_termo, ''));
  v_padrao text;
BEGIN
  IF length(v_termo) < 2 THEN
    RETURN;
  END IF;

  -- SEC-055: sem isto, `%%` devolvia a base inteira com os cargos.
  v_padrao := public.escapar_curinga(v_termo);

  RETURN QUERY
    SELECT pr.id, pr.username, pr.avatar_url, pr.role
      FROM profiles pr
     WHERE pr.banned = false
       AND pr.username ILIKE '%' || v_padrao || '%'
     -- Quem comeca com o termo vem antes de quem so o contem: procurar "pedro"
     -- deve achar @pedro antes de @opedrovini.
     ORDER BY (pr.username ILIKE v_padrao || '%') DESC, length(pr.username), pr.username
     LIMIT v_limite;
END $function$;

-- O radar passa a usar a mesma funcao: o escape dele nao cobria a barra.
CREATE OR REPLACE FUNCTION public.news_aceleracao_de_termos(
  p_termos text[],
  p_janela_dias integer DEFAULT 7
) RETURNS TABLE (termo text, hoje bigint, antes bigint, desde date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT t.termo,
         count(r.id) FILTER (WHERE r.coletado_em >= current_date)::bigint,
         count(r.id) FILTER (WHERE r.coletado_em <  current_date)::bigint,
         min(r.coletado_em)::date
    FROM unnest(p_termos[1:20]) AS t(termo)
    LEFT JOIN news_items_raw r
      ON r.coletado_em > now() - make_interval(days => least(greatest(coalesce(p_janela_dias, 7), 1), 30))
     AND length(btrim(t.termo)) >= 3
     AND r.titulo ILIKE '%' || public.escapar_curinga(btrim(t.termo)) || '%'
   GROUP BY t.termo;
$fn$;

REVOKE ALL ON FUNCTION public.news_aceleracao_de_termos(text[], integer)
  FROM PUBLIC, anon, authenticated;
