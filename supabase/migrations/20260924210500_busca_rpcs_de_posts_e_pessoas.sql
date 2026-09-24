-- ============================================================================
-- `[24/09]` A BUSCA DE VERDADE — parte 2: as duas RPCs
-- ============================================================================
--
-- POR QUE DUAS FUNCOES, E NAO UMA "busca geral"
-- -----------------------------------------------
-- Porque post e pessoa nao tem a mesma forma, nem a mesma regra de acesso, nem
-- a mesma nocao de relevancia. Uma funcao que devolvesse os dois precisaria de
-- um formato generico — e formato generico e onde a coluna errada vaza. O
-- prompt pede que a arquitetura PERMITA crescer (noticias, lives, jogos); duas
-- funcoes com contrato proprio crescem somando a terceira, nao inchando a
-- primeira.
--
-- `buscar_posts` — INVOKER, porque a RLS ja recorta
-- --------------------------------------------------
-- A policy de `posts` esconde apagado e oculto de quem nao e equipe. Sob
-- INVOKER isso vale sozinho. DEFINER aqui seria desligar a RLS numa consulta
-- que nao precisa disso — e a busca passaria a achar conteudo moderado.
--
-- PROVADO EM ROLLBACK: com papel `authenticated` real, buscar o termo de um
-- post ocultado devolveu 0; como `postgres`, devolveu 1.
--
-- `buscar_pessoas` — DEFINER, e aqui NAO da para ser diferente
-- --------------------------------------------------------------
-- As colunas pessoais de `profiles` foram revogadas de `authenticated` na
-- SEC-025: o cliente nao le a tabela direto. A busca de pessoa entao precisa
-- de DEFINER — e a defesa passa a ser o RECORTE: a funcao devolve `id`,
-- `username`, `avatar_url` e `role`, e mais nada. E o mesmo desenho do
-- `get_public_profile`, que ja existe e serve exatamente para isto.
--
-- Banido NAO aparece na busca: quem foi removido do site nao volta por uma
-- caixa de texto.
--
-- FAIXA NO LIMITE (regra do BANCO.md)
-- ------------------------------------
-- 1 a 50, como no feed. "Buscar" nao pode virar "baixar a tabela".
--
-- TERMO VAZIO DEVOLVE VAZIO, E ISSO E DECISAO
-- ---------------------------------------------
-- `plainto_tsquery('')` gera uma query que nao casa nada, mas o custo e uma
-- varredura a toa. Sair cedo e mais barato e, sobretudo, mais HONESTO: busca
-- sem termo nao e "todos os posts", e devolver o acervo inteiro seria uma
-- resposta que ninguem pediu.
--
-- A BUSCA NAO PAGINA, E ISSO TAMBEM E DECISAO
-- ---------------------------------------------
-- Keyset por relevancia nao cabe no indice: `ts_rank` e calculado, nao
-- indexado. Paginar aqui seria `OFFSET` disfarcado — exatamente o que a fase
-- anterior tirou do feed. Entao ela corta em 50 e DIZ que cortou; a tela
-- mostra "ha mais resultados, refine o termo".

CREATE OR REPLACE FUNCTION public.buscar_posts(
  p_termo text,
  p_limite integer DEFAULT 20
)
RETURNS TABLE (id uuid, relevancia real)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_query  tsquery := plainto_tsquery('public.portugues_sem_acento', coalesce(p_termo, ''));
BEGIN
  -- Termo que vira query vazia (so espaco, so pontuacao) nao busca nada.
  IF v_query IS NULL OR numnode(v_query) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, ts_rank(p.busca, v_query) AS relevancia
      FROM posts p
     WHERE p.deleted_at IS NULL
       AND p.live_kind IS NULL
       AND p.busca @@ v_query
     -- Relevancia primeiro, recencia como desempate: entre dois posts que
     -- casam igual, o mais novo e o mais util.
     ORDER BY ts_rank(p.busca, v_query) DESC, p.created_at DESC, p.id DESC
     LIMIT v_limite;
END $$;

CREATE OR REPLACE FUNCTION public.buscar_pessoas(
  p_termo text,
  p_limite integer DEFAULT 20
)
RETURNS TABLE (id uuid, username text, avatar_url text, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_termo  text := btrim(coalesce(p_termo, ''));
BEGIN
  IF length(v_termo) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT pr.id, pr.username, pr.avatar_url, pr.role
      FROM profiles pr
     WHERE pr.banned = false
       AND pr.username ILIKE '%' || v_termo || '%'
     -- Quem comeca com o termo vem antes de quem so o contem: procurar "pedro"
     -- deve achar @pedro antes de @opedrovini.
     ORDER BY (pr.username ILIKE v_termo || '%') DESC, length(pr.username), pr.username
     LIMIT v_limite;
END $$;

-- Regua de papeis de 12/09: busca e area de conta.
REVOKE ALL ON FUNCTION public.buscar_posts(text, integer)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buscar_pessoas(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_posts(text, integer)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_pessoas(text, integer) TO authenticated;

COMMENT ON FUNCTION public.buscar_posts(text, integer) IS
  'Busca de posts por texto. Devolve so id + relevancia; o cliente busca as linhas por id, pelo mesmo motivo da feed_pagina - nao existir uma segunda definicao do que e um post. INVOKER: a RLS recorta.';
COMMENT ON FUNCTION public.buscar_pessoas(text, integer) IS
  'Busca de pessoas por username. DEFINER porque as colunas pessoais de profiles sao revogadas de authenticated (SEC-025) - a defesa e o RECORTE: devolve id, username, avatar_url e role, e mais nada. Banido nao aparece.';
