-- `[12/09]` A RÉGUA DE PAPÉIS, decidida pelo dono e agora imposta no banco.
--
-- Palavras dele: *"admin, super admin e owner são os que têm poderes no site e
-- acesso às coisas. Agora user e anon não pode 'nada', nada que dê poder a eles
-- ou ver coisas sensíveis. Não quero que anon veja nada — fecha isso para o
-- anon e para qualquer caso a partir de hoje."*
--
-- ── O que estava errado, e MEDIDO antes de mexer ────────────────────────────
--
-- `anon` tinha SELECT em 26 das 29 tabelas e INSERT/UPDATE/DELETE em 26 delas —
-- incluindo `admin_logs` (2.561 linhas), `moderation_queue`, `violations`,
-- `reports`, `unban_requests` e `staff_nominations`.
--
-- **A RLS estava segurando**: assumindo o papel `anon`, só três tabelas
-- devolviam linha (`site_config` 14, `game_keys` 6, `community_post_media` 1).
-- Ou seja, isto NÃO fecha um vazamento em curso — fecha a distância entre "o
-- que a policy permite hoje" e "o que o privilégio permitiria". Toda vez que
-- alguém escrever uma policy nova com `USING (true)`, o grant já estaria lá
-- esperando. Foi assim que `live_chat` ficou com policy aberta E grant: a
-- tabela está vazia hoje, e no dia da primeira live o chat inteiro seria
-- legível sem conta.
--
-- ── Por que `site_config` fica, e é a ÚNICA ─────────────────────────────────
--
-- É a única tabela que uma tela de deslogado lê (`useConfigDoSite`), e ela
-- carrega o modo manutenção e os portões de funcionalidade. Sem ela, o site
-- fora do ar deixa de conseguir dizer que está fora do ar.
-- `updated_by` continua de fora — foi revogada no SEC-005.
--
-- Todo o resto que o público usa passa por RPC (`username_disponivel`,
-- `check_login_status`) ou Edge Function (`verify-contact`), e privilégio de
-- FUNÇÃO não é tocado por revoke de TABELA. Conferido em transação.
--
-- ── Validado em ROLLBACK antes de aplicar (§5) ──────────────────────────────
--
--   anon depois:      NENHUMA tabela legível além de site_config
--   anon RPC pública: continua funcionando
--   usuário REAL:     posts 275 -> 275 · comments 62 -> 62 · game_keys 6 -> 6
--                     notifications 2 -> 2 · community_posts 1 -> 1
--
-- `authenticated` NÃO é membro de `anon` (conferido em `pg_auth_members`), por
-- isso revogar de um não toca o outro.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tablename);
  END LOOP;
END $$;

-- A única exceção, por coluna e não por tabela: se alguém acrescentar uma
-- coluna sensível a `site_config` amanhã, ela NÃO nasce legível.
GRANT SELECT (key, value, updated_at) ON public.site_config TO anon;

-- ── "e para qualquer caso a partir de hoje" ─────────────────────────────────
-- Sem isto, a próxima tabela criada nasceria com os grants padrão e a régua
-- valeria só para o retrato de hoje. É a diferença entre limpar e fechar.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

COMMENT ON TABLE public.site_config IS
  'Config global do site. UNICA tabela legivel por anon (colunas key, value, '
  'updated_at) — o modo manutencao precisa funcionar para quem nao esta logado. '
  'Regra do dono em 12/09: anon nao le mais nada. Ver db/2026-09-12-*.md';
