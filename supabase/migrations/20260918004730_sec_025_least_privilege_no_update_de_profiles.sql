-- SEC-025 · `[18/09]` `authenticated` deixa de poder ESCREVER as colunas
-- privilegiadas de `profiles`. Least privilege, e o trigger vira a SEGUNDA
-- camada em vez da unica.
--
-- ── O achado, que foi DELE ──────────────────────────────────────────────────
--
-- Ele mandou um PATCH direto na Data API para a propria linha com
-- `{"role":"user"}` e recebeu **HTTP 204**. A desconfianca dele estava certa:
-- *"nao assuma que 204 significa que os campos foram modificados"*.
--
-- ── O que a investigacao encontrou (read-only, em ROLLBACK) ────────────────
--
-- `authenticated` tinha **UPDATE nas 25 colunas** da tabela, inclusive as nove
-- privilegiadas. O que impedia o estrago era **um trigger e so ele**:
-- `trg_guard_profile_privileged` reverte role, banned, ban_count,
-- suspended_until, banned_by, banned_by_username, banned_at, ban_reason e
-- ban_details quando `current_user` e `authenticated` ou `anon`.
--
-- Por isso o 204 sem efeito: o comando passa, o guarda reverte por baixo, e o
-- Postgres devolve sucesso. E a fonte de silencio nº 3 do §1.5.
--
-- **Nao havia escalacao** — provado com papel assumido: o `role` gravado
-- continuava `user`, e `is_staff()`/`is_owner()` seguiam `false`.
--
-- ── Entao por que mexer, se nao havia falha ────────────────────────────────
--
-- Porque a protecao era de **CAMADA UNICA**. O grant dizia "pode escrever
-- role"; so o trigger dizia "nao". Desabilitado (`ALTER TABLE ... DISABLE
-- TRIGGER`), renomeado, ou num caminho onde `current_user` nao seja
-- `authenticated`, a escalacao abriria **na hora e em silencio** — sem erro,
-- sem log, sem teste vermelho.
--
-- Depois desta migration sao duas camadas independentes: o privilegio recusa
-- ANTES, e o trigger continua atras como rede.
--
-- ── Ganho de lado: a falha passa a GRITAR ──────────────────────────────────
--
-- Antes: HTTP 204, campo inalterado, ninguem sabe. Agora: erro de privilegio,
-- visivel para quem chamar. Trocar silencio por erro e o §1.5 inteiro.
--
-- ── Por que ISTO nao repete o incidente que ja derrubou o site 3x ──────────
--
-- A POSTURA §1.3 registra: "revogar colunas de profiles (LGPD) -> as policies
-- de INSERT liam suspended_until -> postar, comentar, mural e chat pararam".
-- Aquilo foi revogar **SELECT**. Isto e **UPDATE**.
--
-- Conferido antes de aplicar: **27 policies leem** role/banned de `profiles`, e
-- todas por SELECT — nenhuma e afetada. E **nenhuma funcao SECURITY INVOKER
-- escreve** em profiles. As 10 que escrevem sao SECURITY DEFINER, rodam como
-- `postgres`, e esta revogacao nao as alcanca (verificado: as 10 seguem
-- executaveis).
--
-- ── A lista das 12, e de onde ela saiu ─────────────────────────────────────
--
-- Nao e julgamento: e o que o frontend escreve, lido no codigo.
--   `useProfileForm.js`  -> bio, birth_date, state, platform, playstyle,
--                           favorite_games, discord, twitch, youtube
--   `useAvatarUpload.js` -> avatar_url
--   `profileService.js`  -> notif_likes, notif_comments
--
-- `username` NAO entra: nenhuma tela o altera — ele nasce no
-- `handle_new_user`. `id` e `created_at` tambem nao, pelo motivo obvio.
--
-- Testado em ROLLBACK com papel assumido, 6 asercoes, inclusive a que prova
-- que o UPDATE de `role` era ACEITO antes — sem ela o teste passaria sem ter
-- testado nada.

-- Deny by default: tira tudo primeiro.
REVOKE UPDATE ON public.profiles FROM authenticated;

-- E devolve so o que a tela precisa.
GRANT UPDATE (
  bio, birth_date, state, platform, playstyle, favorite_games,
  discord, twitch, youtube, avatar_url, notif_likes, notif_comments
) ON public.profiles TO authenticated;

COMMENT ON TRIGGER trg_guard_profile_privileged ON public.profiles IS
  'Reverte as 9 colunas privilegiadas quando current_user e authenticated/anon. Desde 17/09 (SEC-025) ele e a SEGUNDA camada, nao a unica: `authenticated` nao tem mais UPDATE nessas colunas. Manter os dois — o privilegio recusa antes, e este trigger cobre o caminho em que current_user nao for authenticated.';
