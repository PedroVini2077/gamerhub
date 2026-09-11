-- ============================================================================
-- SEC-009 — o UPDATE de conteúdo ignorava a hierarquia que o DELETE respeita
-- ============================================================================
--
-- O PROBLEMA, medido em ROLLBACK
-- ------------------------------
-- Um admin (rank 2) contra um post do FUNDADOR (rank 4):
--
--     conteudo="TEXTO TROCADO PELO ADMIN" · oculto=true
--     3_rpc_soft_delete  recusado: Sem permissão para excluir este post
--
-- Ou seja: o caminho oficial (RPC) barrava, e o `PATCH` direto no PostgREST
-- passava. O admin não conseguia APAGAR o post do fundador, mas conseguia
-- REESCREVER e OCULTAR — e reescrever é pior, porque é silencioso.
--
-- A CAUSA: as três tabelas de conteúdo tinham DELETE com hierarquia e UPDATE
-- com checagem PLANA de cargo.
--
--   | tabela           | DELETE                       | UPDATE (antes)        |
--   | posts            | can_moderate_content(user_id)| ... OR is_staff()     |
--   | comments         | can_moderate_content(user_id)| role_rank(...) >= 2   |
--   | community_posts  | can_moderate_content(user_id)| role_rank(...) >= 2   |
--
-- `can_moderate_content` é `role_rank(quem_chama) > role_rank(autor)` — ESTRITO,
-- e é o modelo que este projeto escolheu de propósito (admin não modera admin).
-- `is_staff()` e `role_rank >= 2` são planos: qualquer staff alcança qualquer
-- autor, inclusive quem está acima dele.
--
-- POR QUE NÃO QUEBRA A MODERAÇÃO
-- ------------------------------
-- Ocultar conteúdo é `UPDATE hidden_at` direto (ver `setHiddenAt` em
-- `moderationService.js`), então esta policy É o caminho da moderação. O que
-- muda é só o ALCANCE: staff continua moderando quem está abaixo, e deixa de
-- alcançar quem está acima ou no mesmo nível — igualzinho ao DELETE.
--
-- E não quebra a edição: a tela só oferece "editar" ao AUTOR, dentro de um
-- limite de tempo (`canEdit` em `PostCard.jsx`). O parâmetro `isAdmin` que o
-- `updatePost` recebia vinha do cliente e só servia para tirar o filtro
-- `.eq('user_id')` — quem segurava era a RLS, e agora ela segura direito.
--
-- A FORMA DE CADA UMA, e por que não são iguais
-- ---------------------------------------------
-- `posts` ganha exatamente a expressão do `posts_delete`: autor OU hierarquia.
--
-- `comments` e `community_posts` NÃO tinham o ramo do autor (usuário comum não
-- edita comentário neste site), e acrescentá-lo seria mudança de comportamento
-- disfarçada de conserto. Elas ficam com "é staff **E** (supera o autor OU é o
-- próprio)" — o `OR próprio` existe porque `can_moderate_content(eu_mesmo)` é
-- falso (rank > rank é falso), e sem ele o fundador perderia a capacidade de
-- ocultar o próprio comentário.
--
-- PROVADO EM ROLLBACK, cenário a cenário (um item por post, sem contaminação:
-- ocultar um post o torna invisível para o autor, e o UPDATE seguinte daria 0
-- linhas por SELECT, não por UPDATE — foi o falso negativo do primeiro teste)
-- ---------------------------------------------------------------------------
--     1_admin_oculta_do_FUNDADOR         0 — BLOQUEADO (correto)
--     2_admin_oculta_de_USUARIO          1 — OK, moderacao viva
--     3_admin_reescreve_do_FUNDADOR      0 — BLOQUEADO (correto)
--     4_autor_edita_o_proprio            1 — OK
--     5_fundador_modera_USUARIO          1 — OK
--
--     1_admin_oculta_comentario_do_FUNDADOR  0 — BLOQUEADO (correto)
--     2_admin_oculta_comentario_de_USUARIO   1 — OK, moderacao viva
--     3_admin_oculta_o_PROPRIO               1 — OK (segue podendo)
--     4_usuario_comum_edita_comentario       0 — bloqueado (igual a hoje)
-- ============================================================================

DROP POLICY IF EXISTS posts_update ON public.posts;
CREATE POLICY posts_update ON public.posts FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR can_moderate_content(user_id));

DROP POLICY IF EXISTS comments_update_mod ON public.comments;
CREATE POLICY comments_update_mod ON public.comments FOR UPDATE TO authenticated
  USING (
    role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
    AND (can_moderate_content(user_id) OR (SELECT auth.uid()) = user_id)
  );

DROP POLICY IF EXISTS community_posts_update_mod ON public.community_posts;
CREATE POLICY community_posts_update_mod ON public.community_posts FOR UPDATE TO authenticated
  USING (
    role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
    AND (can_moderate_content(user_id) OR (SELECT auth.uid()) = user_id)
  );
