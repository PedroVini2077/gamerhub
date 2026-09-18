-- SEC-041 · `[18/09]` Comentario e chat de post fora do ar param de ser
-- legiveis por quem nao e da equipe. Achados N11 e N12 da auditoria externa.
--
-- ── O que estava aberto ──────────────────────────────────────────────────
--
-- As policies de SELECT olhavam so o proprio registro:
--
--   comments   -> `hidden_at IS NULL OR role_rank >= 2`
--   live_chat  -> `USING (true)`
--
-- Nenhuma das duas perguntava pelo POST PAI. Medido com papel `authenticated`
-- real: depois de apagar o post, o comum lia **1** comentario e **1** mensagem
-- de chat, enquanto o POST em si devolvia **0 linhas**.
--
-- ── Por que isso importa, e nao e teoria ────────────────────────────────
--
-- Ocultar um post e ato de moderacao, e o motivo costuma ser a CONVERSA, nao o
-- texto do post. Tirar o post e deixar o fio de comentarios legivel pela API
-- resolve metade do problema — e a metade que aparece na tela, nao a que
-- importa.
--
-- E o `EmbedPlayer` some junto com o post, entao a unica coisa que sobrava
-- legivel era exatamente o que a equipe quis tirar do ar.
--
-- ── A escapatoria da equipe e obrigatoria ───────────────────────────────
--
-- `role_rank >= 2` continua lendo tudo. Sem isso a fila de moderacao ficaria
-- cega justamente para o conteudo que ela precisa julgar — seria trocar um
-- buraco por outro, igual ao que quase aconteceu no SEC-025.
--
-- ── `post_likes` ficou de FORA, e a decisao e medida ────────────────────
--
-- A auditoria levantou o mesmo ponto para curtidas (N13) e concluiu que nao e
-- falha. Concordo, e por dois motivos somados:
--
--   1. uma curtida nao carrega conteudo. O que vaza e "fulano curtiu o post X",
--      para quem ja tem o id do post;
--   2. `post_likes` e a leitura MAIS QUENTE do site — o `attachEngagement`
--      busca as curtidas de 30 posts de uma vez, em todo carregamento de feed.
--      Uma policy com subconsulta por linha ali custa caro para sempre.
--
-- Trocar o caminho mais quente do app por um vazamento de valor proximo de
-- zero e a conta errada. Registrado para nao voltar como "esqueceram".
--
-- ── Provado em ROLLBACK, papel `authenticated` real ─────────────────────
--
--   comum le comentario de post VIVO ......... 1  (nao quebrou)
--   comum le comentario de post APAGADO ...... 0  (N11 fechado)
--   comum le chat de post VIVO ............... 1  (nao quebrou)
--   comum le chat de post APAGADO ............ 0  (N12 fechado)
--   EQUIPE le comentario de post APAGADO ..... 1  (moderacao intacta)
--   EQUIPE le chat de post APAGADO ........... 1  (moderacao intacta)

DROP POLICY comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT TO public
USING (
  (hidden_at IS NULL AND post_aceita_interacao(post_id))
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);

DROP POLICY "Todos veem chat" ON public.live_chat;
CREATE POLICY live_chat_select ON public.live_chat FOR SELECT TO public
USING (
  post_aceita_interacao(post_id)
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
