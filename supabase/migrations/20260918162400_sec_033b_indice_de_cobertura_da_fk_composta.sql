-- SEC-033b · `[18/09]` O indice que a FK composta da SEC-033 passou a exigir.
--
-- ── Divida que EU criei, na mesma sessao ──────────────────────────────────
--
-- A SEC-033 trocou `FOREIGN KEY (parent_id)` por
-- `FOREIGN KEY (parent_id, post_id)`. O `get_advisors` de performance acusou
-- na hora: `unindexed_foreign_keys` em `comments_parent_no_mesmo_post`.
--
-- O indice `idx_comments_post_id` cobre `(post_id)` e o antigo cobria
-- `(parent_id)` — nenhum dos dois cobre o PAR, que e o que a FK nova usa.
--
-- ── Por que isso importa aqui, e nao e teoria ─────────────────────────────
--
-- Sem indice de cobertura, **apagar um comentario** obriga o Postgres a varrer
-- `comments` inteira procurando filhos para o `ON DELETE CASCADE`. Hoje a
-- tabela e pequena e ninguem sente; numa thread grande, apagar o comentario
-- raiz vira varredura completa.
--
-- E o caminho de apagar comentario NAO e raro: e o botao da moderacao, e o
-- `ban_user` apaga conteudo em lote.
--
-- ── A ordem das colunas ───────────────────────────────────────────────────
--
-- `(parent_id, post_id)` e nao o inverso: e a ordem da propria FK, e e a que o
-- Postgres usa para checar a referencia. Ela tambem serve as consultas que
-- filtram so por `parent_id` (prefixo do indice), que e como se busca "as
-- respostas deste comentario".

CREATE INDEX IF NOT EXISTS idx_comments_parent_post
  ON public.comments (parent_id, post_id);

COMMENT ON INDEX public.idx_comments_parent_post IS
  'SEC-033b: cobertura da FK composta comments_parent_no_mesmo_post. Sem ele, apagar comentario varre a tabela para o CASCADE.';
