-- ============================================================================
-- `[24/09]` A BUSCA DE VERDADE — parte 1: o dicionario e o indice
-- ============================================================================
--
-- O QUE A BUSCA ERA
-- -----------------
-- `posts.filter(...)` no cliente, sobre o que ja estava carregado. Com a
-- paginacao de hoje isso ficou pior do que era: o campo dizia "Buscar posts" e
-- procurava nos 20 que voce rolou. Resposta errada apresentada como completa.
--
-- POR QUE UM DICIONARIO PROPRIO, E NAO `portuguese` PURO
-- --------------------------------------------------------
-- Medido antes de escolher:
--
--   to_tsvector('portuguese','configuração') @@ plainto_tsquery('portuguese','configuracao')
--     -> NAO casa
--
-- Num site brasileiro isso e inaceitavel: ninguem digita acento na busca. O
-- `portuguese` faz bem a flexao ("jogos" acha "jogo" — medido, casa), e nao faz
-- nada por acento.
--
-- A saida e uma CONFIGURACAO propria: `unaccent` antes do radicalizador.
--
--   configuração -> configuraca      configuracao -> configuraca
--   vídeo        -> vid              video        -> vid
--
-- Medido depois: casa nos DOIS sentidos, e a flexao continua funcionando.
--
-- POR QUE CONFIGURACAO, E NAO CHAMAR `unaccent()` NA EXPRESSAO
-- --------------------------------------------------------------
-- `unaccent(text)` e STABLE, nao IMMUTABLE — e coluna gerada e indice exigem
-- IMMUTABLE. Ja `to_tsvector(regconfig, text)` e IMMUTABLE (conferido em
-- `pg_proc.provolatile` = 'i'), qualquer que seja o dicionario dentro da
-- configuracao. Embrulhar o unaccent numa config resolve a imutabilidade sem
-- gambiarra de `IMMUTABLE` mentiroso, que e o atalho comum e errado.
--
-- POR QUE COLUNA GERADA, E NAO INDICE DE EXPRESSAO
-- --------------------------------------------------
-- As duas indexam igual. A coluna gerada deixa o `tsvector` LEGIVEL: da para
-- conferir o que o banco entendeu de um post sem reproduzir a expressao a mao.
-- Numa busca que nao acha o que deveria, essa e a primeira pergunta.
--
-- CUSTO: um `tsvector` por linha, que o cliente NUNCA seleciona (o
-- `POST_SELECT` lista colunas explicitas). Nao viaja, so ocupa disco.
--
-- O QUE FICA DE FORA, E E DELIBERADO
-- ------------------------------------
-- `pg_trgm` — busca por trecho e por erro de digitacao. E outra extensao,
-- outro indice e outra conta de custo; entra quando houver acervo que
-- justifique. Hoje a busca acha palavra, nao pedaco de palavra.

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

CREATE TEXT SEARCH CONFIGURATION public.portugues_sem_acento ( COPY = pg_catalog.portuguese );

ALTER TEXT SEARCH CONFIGURATION public.portugues_sem_acento
  ALTER MAPPING FOR hword, hword_part, word
  WITH extensions.unaccent, portuguese_stem;

COMMENT ON TEXT SEARCH CONFIGURATION public.portugues_sem_acento IS
  'Portugues com unaccent ANTES do radicalizador. Existe porque o `portuguese` puro nao casa "configuracao" com "configuração" - medido em 24/09 - e num site brasileiro ninguem digita acento na busca.';

ALTER TABLE public.posts ADD COLUMN busca tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.portugues_sem_acento',
                coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

COMMENT ON COLUMN public.posts.busca IS
  'Indice de texto do titulo + conteudo, gerado pelo banco. Coluna gerada (e nao indice de expressao) para o tsvector ser LEGIVEL: numa busca que nao acha o que deveria, a primeira pergunta e o que o banco entendeu do post. O cliente nunca a seleciona.';

CREATE INDEX idx_posts_busca ON public.posts USING GIN (busca)
  WHERE deleted_at IS NULL AND live_kind IS NULL;

COMMENT ON INDEX public.idx_posts_busca IS
  'GIN da busca. Parcial pelo MESMO recorte do feed - indice parcial so serve se a consulta repetir a condicao dele.';
