-- SEC-033 · `[18/09]` Uma resposta nao pode pertencer a um post e responder a
-- um comentario de OUTRO post. Achado 06L da auditoria externa.
--
-- ── O que a FK antiga garantia, e o que ela NAO garantia ──────────────────
--
--   comments_parent_id_fkey  FOREIGN KEY (parent_id) REFERENCES comments(id)
--
-- Ela garante que o pai EXISTE. Nao diz nada sobre ONDE ele esta. Entao isto
-- era aceito e persistido:
--
--   filho.post_id   = Post B
--   filho.parent_id = comentario que vive no Post A
--
-- ── O estrago NAO e vazamento — e pior de achar do que isso ───────────────
--
-- A hipotese levantada foi "vazar conteudo do Post A no Post B". **Nao vaza:**
-- o `fetchComments` filtra por `post_id`, entao o texto do pai nunca e trazido,
-- e a tela nunca o renderiza.
--
-- O que acontece de verdade esta no `CommentSection.jsx`:
--
--   const rootIdOf = (c) => {
--     let cur = c;
--     while (cur.parent_id && byId[cur.parent_id]) cur = byId[cur.parent_id];
--     return cur.id;      // <- para aqui quando o pai NAO esta na lista
--   };
--   const rootList = comments.filter(c => !c.parent_id);
--
-- O orfao tem `parent_id`, entao **nao entra em `rootList`**. E o `rootIdOf`
-- devolve o id DELE MESMO, entao ele e arquivado em `repliesByRoot[ele]` — um
-- balde que nada renderiza, porque ele nao e raiz.
--
-- **Resultado: o comentario existe, e buscado (custa egress), e NUNCA aparece
-- na tela.** Mas o `fetchCommentCount` conta ele, porque conta por `post_id`.
--
-- Isso e §1.5 puro: o contador diz 3, a thread mostra 2, nada estoura, nada
-- loga, e a moderacao nao alcanca o conteudo porque ele nao renderiza para
-- ninguem clicar.
--
-- ── Por que FK COMPOSTA e nao trigger nem RLS ─────────────────────────────
--
-- A tabela do §2 e explicita: constraint e a trava de 1a forca, porque faz o
-- dado errado ser **impossivel**; trigger e 3a; validacao de aplicacao nem
-- entra. Aqui a constraint cabe, entao nao ha razao para descer de nivel.
--
-- Ela exige a UNIQUE `(id, post_id)` — redundante com a PK em `id`, mas o
-- Postgres precisa dela para aceitar a FK composta. E o `MATCH SIMPLE` (padrao)
-- e o que mantem comentario RAIZ funcionando: com `parent_id` NULL a
-- constraint e satisfeita sem checar nada.
--
-- ── A linha que ja existia ────────────────────────────────────────────────
--
-- Havia **uma** violacao no banco, e ela e artefato de laboratorio declarado no
-- relatorio da auditoria: `5814a9d8-a474-4190-93a2-6446b80e2af7`,
-- "[PENTEST 06L] filho no Post B apontando para pai do Post A". Conferido id,
-- texto e os dois posts antes de apagar — nenhum dado de producao foi tocado.
--
-- ── Provado em ROLLBACK ───────────────────────────────────────────────────
--
--   ATAQUE  filho no Post B com pai do Post A ....... FECHADO
--   LEGITIMO resposta no MESMO post ................. ok
--   LEGITIMO comentario raiz (parent_id NULL) ....... ok
--   LEGITIMO apagar o pai ainda leva os filhos ...... 0 orfaos (CASCADE vivo)

DELETE FROM public.comments WHERE id = '5814a9d8-a474-4190-93a2-6446b80e2af7';

ALTER TABLE public.comments ADD CONSTRAINT comments_id_post_id_key UNIQUE (id, post_id);

ALTER TABLE public.comments DROP CONSTRAINT comments_parent_id_fkey;

ALTER TABLE public.comments ADD CONSTRAINT comments_parent_no_mesmo_post
  FOREIGN KEY (parent_id, post_id) REFERENCES public.comments(id, post_id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT comments_parent_no_mesmo_post ON public.comments IS
  'SEC-033: o pai precisa estar NO MESMO POST. A FK simples so garantia que ele existia, e o orfao sumia da tela mas contava no contador.';
