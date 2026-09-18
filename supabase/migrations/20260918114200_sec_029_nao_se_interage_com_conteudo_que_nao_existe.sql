-- SEC-029 · `[18/09]` Comentario, curtida e chat passam a exigir que o post
-- ALVO exista de verdade. Fecha o GH-CONTENT-001 — e mais dois iguais que o
-- pentest nao testou.
--
-- ── O achado, e a varredura de CLASSE que ele obrigou (§1.3) ──────────────
--
-- O relatorio trouxe um caso: comentar em post soft-deletado devolvia HTTP 201.
-- A `comments_insert` conferia `auth.uid() = user_id AND pode_publicar()` e
-- **nada sobre o post pai**.
--
-- A regra do §1.3 e "onde MAIS esse padrao existe?". Tres tabelas penduram
-- linha em `posts.id`, e as tres tinham exatamente o mesmo buraco:
--
--   comments    -> comentar em post apagado/oculto
--   post_likes  -> curtir post apagado/oculto
--   live_chat   -> mandar mensagem no chat de uma live apagada
--
-- Corrigir so o `comments` deixaria dois iguais no ar — foi assim que 14
-- policies ficaram sem `owner` tres vezes seguidas.
--
-- ── Por que isso importa alem do XP ──────────────────────────────────────
--
-- O XP ja foi resolvido pela SEC-028 (conteudo morto nao conta mais). O que
-- sobra aqui e pior e nao aparece em contador nenhum: **conteudo pendurado em
-- conteudo invisivel**. O comentario e gravado, nenhuma tela o mostra, e ele
-- fica na base sem caminho de moderacao — a fila mostra o pai, nao o orfao.
--
-- E o `hidden_at` fecha o circulo: ocultar um post e uma ACAO DE MODERACAO.
-- Deixar comentar embaixo dele e deixar a conversa continuar num lugar que a
-- equipe ja decidiu tirar do ar.
--
-- ── O helper, e o motivo de ele ser SECURITY DEFINER ─────────────────────
--
-- A policy roda com o papel de QUEM insere. Um `EXISTS` cru sobre `posts`
-- passaria pela RLS de `posts` — que ja esconde apagado e oculto —, e o
-- resultado ate seria o mesmo hoje. Mas ficaria dependendo de um efeito
-- colateral da policy de SELECT de outra tabela, que e exatamente a "protecao
-- acidental" que o §1.3 manda desconfiar: bastaria alguem afrouxar o SELECT de
-- `posts` para reabrir isto aqui, em silencio.
--
-- E ele leva `GRANT EXECUTE TO authenticated` porque **funcao chamada DENTRO de
-- policy precisa de EXECUTE para o papel que dispara a policy** — sem isso a
-- policy inteira falha, para todo mundo. Foi a licao do SEC-026, onde revogar 9
-- funcoes "sem chamador no frontend" teria derrubado 28 policies.
--
-- ── Provado em ROLLBACK, papel `authenticated` real ──────────────────────
--
--   ATAQUES                                  CAMINHOS QUE NAO PODIAM QUEBRAR
--     comentar em apagado ..... FECHADO        comentar em post vivo ..... ok
--     comentar em oculto ...... FECHADO        curtir post vivo .......... ok
--     curtir apagado .......... FECHADO        chat em live viva ......... ok
--     chat em apagado ......... FECHADO

CREATE OR REPLACE FUNCTION public.post_aceita_interacao(p_post_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (SELECT 1 FROM posts
                  WHERE id = p_post_id AND deleted_at IS NULL AND hidden_at IS NULL);
$fn$;

REVOKE EXECUTE ON FUNCTION public.post_aceita_interacao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.post_aceita_interacao(uuid) TO authenticated;

DROP POLICY comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND pode_publicar() AND post_aceita_interacao(post_id));

DROP POLICY live_chat_insert ON public.live_chat;
CREATE POLICY live_chat_insert ON public.live_chat FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND pode_publicar() AND post_aceita_interacao(post_id));

DROP POLICY "User insere proprio like" ON public.post_likes;
CREATE POLICY "User insere proprio like" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND post_aceita_interacao(post_id));
