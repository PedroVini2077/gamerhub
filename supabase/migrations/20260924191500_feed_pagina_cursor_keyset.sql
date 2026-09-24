-- ============================================================================
-- `[24/09]` A pagina do feed por CURSOR — e a medicao que decidiu a forma
-- ============================================================================
--
-- POR QUE UMA RPC, E NAO A CONSULTA DIRETA DO POSTGREST
-- ------------------------------------------------------
-- Keyset precisa de comparacao de LINHA: `(created_at, id) < (cursor, id)`.
-- O PostgREST nao sabe expressar isso — o mais proximo seria
-- `.or(created_at.lt.X, and(created_at.eq.X, id.lt.Y))`.
--
-- Nao e questao de gosto. Medido com 300 linhas semeadas, pagina do meio:
--
--   ROW(created_at,id) < ROW(...)   -> Index Cond, 0 linhas filtradas,  20 heap
--   OR (eq AND id <)                -> FILTER,   100 linhas filtradas, 239 heap
--
-- A segunda forma varre o indice desde o topo e joga fora tudo que ja passou:
-- e o custo do `OFFSET` com outro nome, e piora a cada pagina.
--
-- POR QUE DOIS RAMOS, E NAO UM `OR` PARA O CURSOR NULO
-- -----------------------------------------------------
-- A forma obvia seria `WHERE (p_cursor IS NULL OR ROW(...) < ROW(...))`.
-- Medida tambem: o `OR` SOZINHO ja derruba o Index Cond para Filter — 100
-- linhas removidas na mesma consulta. Entao a primeira pagina e a seguinte sao
-- dois `RETURN QUERY` distintos, cada um com a condicao exata que o indice
-- entende.
--
-- POR QUE SO OS IDS
-- -----------------
-- O `POST_SELECT` do cliente ja traz `profiles` e `post_media` por embed do
-- PostgREST. Reescrever esse embed em SQL criaria uma SEGUNDA definicao do que
-- e um post no feed — a duplicacao que o §4 proibe, no lugar mais caro. Aqui
-- sai so a ORDEM; o cliente busca as linhas por `id` e reordena.
--
-- SECURITY INVOKER, de proposito
-- -------------------------------
-- A RLS de `posts` ja esconde apagado e oculto de quem nao e equipe. Sob
-- INVOKER isso continua valendo sozinho — `DEFINER` aqui seria transformar uma
-- consulta comum numa que passa por cima da RLS sem nenhuma necessidade.
--
-- FAIXA NO LIMITE (regra do BANCO.md)
-- ------------------------------------
-- `p_limite integer` aceita 100000. O teto de 50 existe porque o pedido do
-- dono e explicito: "500 novos posts != carregar 500 posts". O tipo diz o
-- formato; a faixa diz o que faz sentido.
--
-- PROVADO EM ROLLBACK ANTES DE APLICAR
-- -------------------------------------
--   300 semeados  -> pag.1 = 20, pag.2 = 20, repetidos entre elas = 0
--   60 com created_at IDENTICO -> 3 paginas, 60 distintos, 0 de fora
--   feed_pagina(5000) -> 50     feed_pagina(0) -> 1
--   cursor pela metade -> estourou (em vez de devolver vazio em silencio)
--   papel `anon` -> negado

CREATE OR REPLACE FUNCTION public.feed_pagina(
  p_limite integer DEFAULT 20,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
BEGIN
  -- Cursor pela metade e erro de quem chama, nao "primeira pagina". Sem isto a
  -- comparacao de linha com NULL devolveria ZERO linhas em silencio, e a tela
  -- diria "acabou" no meio do feed (§1.5).
  IF (p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'Cursor incompleto: mande os dois campos (created_at e id) ou nenhum.';
  END IF;

  IF p_cursor_created_at IS NULL THEN
    RETURN QUERY
      SELECT p.id, p.created_at
        FROM posts p
       WHERE p.deleted_at IS NULL
         AND p.live_kind IS NULL
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT v_limite;
  ELSE
    RETURN QUERY
      SELECT p.id, p.created_at
        FROM posts p
       WHERE p.deleted_at IS NULL
         AND p.live_kind IS NULL
         AND (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT v_limite;
  END IF;
END $$;

-- Regua de papeis de 12/09: o feed e area de conta, `anon` nao alcanca nada.
REVOKE ALL ON FUNCTION public.feed_pagina(integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_pagina(integer, timestamptz, uuid) TO authenticated;

COMMENT ON FUNCTION public.feed_pagina(integer, timestamptz, uuid) IS
  'Uma pagina do feed por keyset (created_at, id). Devolve so a ORDEM - o cliente busca as linhas por id, para nao existir uma segunda definicao do que e um post no feed. INVOKER: a RLS de posts ja faz o recorte.';
