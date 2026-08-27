-- ═══════════════════════════════════════════════════════
-- CORREÇÃO 1: live_chat — qualquer usuário logado podia
-- deletar mensagem de qualquer outro usuário
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Auth deleta mensagem do chat" ON live_chat;
-- A policy "Dono e admin deletam mensagens" já está correta e fica ativa.

-- ═══════════════════════════════════════════════════════
-- CORREÇÃO 2: live_muted — qualquer usuário logado podia
-- silenciar ou des-silenciar qualquer pessoa em qualquer live
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Auth pode remover silencio" ON live_muted;
DROP POLICY IF EXISTS "Auth pode silenciar"         ON live_muted;

CREATE POLICY "Admin e dono silenciam" ON live_muted
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
  )
  OR auth.uid() IN (
    SELECT posts.user_id FROM posts WHERE posts.id = live_muted.post_id
  )
);

CREATE POLICY "Admin e dono removem silencio" ON live_muted
FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
  )
  OR auth.uid() IN (
    SELECT posts.user_id FROM posts WHERE posts.id = live_muted.post_id
  )
);

-- ═══════════════════════════════════════════════════════
-- CORREÇÃO 3: game_keys — sem policy de DELETE, admins
-- não conseguiam deletar keys pelo painel
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins deletam keys" ON game_keys;

CREATE POLICY "Admins deletam keys" ON game_keys
FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
  )
);

-- ═══════════════════════════════════════════════════════
-- CORREÇÃO 4: admin_logs — qualquer usuário autenticado
-- podia inserir logs falsos no histórico de admins
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "admins_insert_logs" ON admin_logs;

CREATE POLICY "admins_insert_logs" ON admin_logs
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
  )
);

-- ═══════════════════════════════════════════════════════
-- CORREÇÃO 5: admin_notification_reads — qualquer usuário
-- autenticado podia marcar notificações de admin como lidas
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "admins_insert_reads" ON admin_notification_reads;

CREATE POLICY "admins_insert_reads" ON admin_notification_reads
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
  )
  AND admin_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════
-- CORREÇÃO 6: post_likes — sem WITH CHECK, um usuário
-- podia curtir como se fosse outra pessoa
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "User insere proprio like" ON post_likes;

CREATE POLICY "User insere proprio like" ON post_likes
FOR INSERT WITH CHECK (
  auth.uid() = user_id
);
;
