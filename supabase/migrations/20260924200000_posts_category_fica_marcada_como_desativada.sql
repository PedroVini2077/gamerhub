-- `[24/09]` `posts.category` fica, DESATIVADA e marcada como tal.
--
-- A coluna saiu da experiencia em 24/09 (seletor, filtro, badge, INSERT e
-- POST_SELECT). Ela permanece no schema por pedido explicito do dono:
-- "nao executar DROP COLUMN simplesmente porque a UI nao usa mais o campo".
--
-- O pedido dele hoje foi "deixa de lado desativado, mas em algum lugar que a
-- gente saiba que ele existe". Um comentario de coluna e o unico lugar que
-- viaja JUNTO com o schema: quem abrir a tabela no painel, num dump ou num
-- `\d+ posts` ve o aviso sem precisar achar o documento certo.
--
-- Nada no banco le esta coluna: zero policy, funcao, view, indice ou
-- constraint (medido na Fase 0). O `DEFAULT 'dica'` continua, para o INSERT
-- que nao a manda seguir funcionando.
COMMENT ON COLUMN public.posts.category IS
  'DESATIVADA em 24/09 — saiu da experiencia (seletor, filtro, badge, INSERT e POST_SELECT). NAO apagar sem decisao do dono: ver docs/DECISOES.md (secao Feed) e a trava categoriaSaiuDaExperiencia.test.js. Nada no banco le esta coluna; o DEFAULT dica so mantem o INSERT funcionando.';
