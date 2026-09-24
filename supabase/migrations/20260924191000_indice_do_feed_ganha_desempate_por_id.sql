-- ============================================================================
-- `[24/09]` O indice do feed ganha o desempate por `id` — base do cursor
-- ============================================================================
--
-- O QUE MUDA, E POR QUE O `id` NAO E DETALHE
-- -------------------------------------------
-- O feed passou a paginar por KEYSET: a proxima pagina pede o que vem depois
-- do ultimo item ja visto, comparando `(created_at, id) < (ultimo, ultimo_id)`.
--
-- Sem o `id` no desempate, dois posts com o MESMO `created_at` — que acontece
-- em publicacao em lote, em seed e em qualquer rajada — fazem o cursor pular
-- um ou repetir o outro. E o requisito "sem duplicar" do pedido do dono
-- resolvido pela ESTRUTURA, nao por remendo no cliente.
--
-- Provado em ROLLBACK com 60 posts de created_at IDENTICO: tres paginas de 20,
-- 60 ids distintos, ZERO repetido e ZERO faltando.
--
-- E sem o `id` NO INDICE, o Postgres acha as linhas pelo `created_at` e depois
-- ordena o empate na memoria. Com ele, a ordem sai pronta do indice.
--
-- POR QUE NAO `OFFSET`
-- --------------------
-- `OFFSET 500` manda o banco varrer 500 linhas e jogar fora. Keyset custa o
-- mesmo na pagina 1 e na 50, porque sempre entra no indice no ponto certo.
--
-- O ANTIGO SAI, E ISSO E SEGURO
-- ------------------------------
-- `idx_posts_feed` era `(created_at DESC)` com o mesmo `WHERE`. O novo e um
-- SUPERCONJUNTO: toda consulta que usava o antigo usa o novo, porque o prefixo
-- da chave e identico. Ordem: cria o novo PRIMEIRO, so depois derruba o velho —
-- nunca deixar a tabela sem indice de feed, nem por um instante.
--
-- O `WHERE` parcial e o mesmo da RPC `feed_pagina`, de proposito: indice
-- parcial so serve se a consulta repetir a condicao dele.

CREATE INDEX IF NOT EXISTS idx_posts_feed_cursor
  ON public.posts (created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND live_kind IS NULL;

DROP INDEX IF EXISTS public.idx_posts_feed;

COMMENT ON INDEX public.idx_posts_feed_cursor IS
  'Feed paginado por keyset. O `id` e o desempate: sem ele, posts com o mesmo created_at fazem o cursor pular ou repetir. Substituiu idx_posts_feed em 24/09.';
