-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 3 da auditoria — banco
-- ═══════════════════════════════════════════════════════════════════════════

-- P3-1 (ALTO) — `profiles` tinha SELECT `USING (true)` para `public`, o que
-- inclui `anon`: QUALQUER pessoa, sem login nenhum, podia baixar a tabela
-- inteira de usuários. Isso expunha:
--   • `birth_date` — dado pessoal coletado justamente por exigência da LGPD;
--   • `ban_reason` / `ban_details` / `banned_by_username` / `ban_count` /
--     `suspended_until` — histórico de moderação de todo mundo;
--   • `role` — mapa de quem é admin/owner, prato feito pra escolher alvo;
--   • a lista completa de usernames (enumeração).
--
-- RLS é por LINHA, não por coluna — então a restrição correta aqui é
-- privilégio de coluna. O único acesso anônimo legítimo é a checagem de
-- username duplicado na tela de cadastro, que precisa de (id, username).
REVOKE SELECT ON public.profiles FROM anon;
GRANT  SELECT (id, username) ON public.profiles TO anon;

-- P3-2 — FKs para auth.users com ON DELETE NO ACTION travariam a exclusão de
-- conta: bastava o usuário ter mexido na config do site ou silenciado alguém
-- numa live, e `delete_own_account` (ou a exclusão pelo painel) passaria a
-- falhar com erro de FK. Hoje as tabelas estão vazias, então nunca estourou —
-- é exatamente o tipo de bug que só aparece quando o site é usado de verdade.
-- SET NULL preserva o histórico (a linha continua, só perde o autor).
ALTER TABLE public.live_chat_timeouts
  DROP CONSTRAINT live_chat_timeouts_created_by_fkey,
  ADD  CONSTRAINT live_chat_timeouts_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.site_config
  DROP CONSTRAINT site_config_updated_by_fkey,
  ADD  CONSTRAINT site_config_updated_by_fkey
       FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;;
