-- ============================================================================
-- SEC-020 🟠 — um ADMIN bane o FUNDADOR por um caminho lateral
-- ============================================================================
--
-- O achado mais grave desta auditoria, e o desenho dele é instrutivo: **os dois
-- caminhos existiam, a hierarquia estava escrita só num deles.**
--
-- ── Provado em ROLLBACK, os dois lados na mesma transação ───────────────────
--
-- ```
-- 1_caminho_direto  = BARRADO (correto): Access denied: cannot ban equal or higher role
-- 2_caminho_indireto = o INSERT em violations PASSOU
-- 3_owner_depois    = banned=true motivo="Banimento automático — limite de
--                     infrações atingido (1003 pontos)"
-- 4_conteudo_depois = 0 posts visiveis, 0 comentarios, 0 murais
-- 5_quem_desfaz     = unban_user exige is_super(). Super admins hoje: 0
-- ```
--
-- Uma linha. `INSERT INTO violations (user_id, points) VALUES (<owner>, 999)`.
--
-- ── A corrente inteira, e cada elo estava "certo" sozinho ───────────────────
--
-- | Elo | O que ele faz | Por que passou despercebido |
-- | --- | --- | --- |
-- | policy `violations_insert` | `role_rank(...) >= 2` | checa o **autor** e nunca o **alvo** — parece uma policy de staff normal |
-- | coluna `points` | `integer`, sem CHECK | tipo certo, faixa nenhuma (§5) |
-- | trigger `handle_violation_escalation` | soma e compara com o limite | é só aritmética; não é lugar de hierarquia |
-- | `apply_mod_auto_ban` | bane e apaga o conteúdo | **nenhuma checagem de cargo**, porque "quem chama é o sistema" |
--
-- Nenhum deles é obviamente errado lendo isolado. É a Fase 4 da auditoria em
-- estado puro: os lados concordam consigo mesmos e discordam entre si.
--
-- ── O que torna isto 🟠 e não 🟡 ────────────────────────────────────────────
--
-- **Risco:** qualquer `admin` (rank 2) — o cargo mais baixo da equipe — bane
-- qualquer pessoa, inclusive `super_admin` e o `owner`.
--
-- **Impacto:** o alvo perde a conta e o conteúdo (posts viram `deleted_at`;
-- comentários, mural e chat são **apagados de verdade**). E medido agora: **há
-- 0 super admins**, e `unban_user` exige `is_super()`. Banido o fundador, **não
-- existe caminho de volta pelo site** — só pela credencial do banco.
--
-- **Solução:** as três camadas abaixo. Nenhuma sozinha basta, e a ordem importa
-- — a de baixo é a que vale mesmo se as outras forem contornadas.
-- ============================================================================

-- ── Camada 1 · FAIXA na coluna (§5: tipo diz o formato, faixa diz o sentido) ─
--
-- O `ACTION_POINTS` do painel é `{none:0, warn:1, hide:2, suspend_1d:5,
-- suspend_7d:10}` — **10 é o máximo que a tela consegue produzir**. `999` só
-- existe para quem chama a REST API direto, que é justamente o atacante.
--
-- Com a faixa, derrubar alguém passa a exigir várias linhas em vez de uma — o
-- que não é proteção, é atrito. A proteção está nas camadas 2 e 3; esta existe
-- para que um número absurdo não seja sequer representável.
ALTER TABLE public.violations
  ADD CONSTRAINT violations_points_faixa CHECK (points >= 0 AND points <= 10);

COMMENT ON COLUMN public.violations.points IS
  'Peso da infracao, 0 a 10. O teto e o maior valor do ACTION_POINTS do painel (suspend_7d). Ver SEC-020.';


-- ── Camada 2 · a policy passa a olhar o ALVO, e não só o autor ──────────────
--
-- `can_moderate_content(user_id)` é o mesmo auxiliar que as seis policies de
-- conteúdo já usam desde o SEC-009: rank do ator **estritamente maior** que o
-- do alvo. Registrar infração é ato de moderação, e a hierarquia da moderação
-- deste projeto já estava escrita — esta tabela é que tinha ficado de fora.
--
-- Efeito colateral aceito: ninguém registra infração contra si mesmo (rank não
-- é maior que o próprio). As 4 linhas históricas do `owner` contra ele mesmo
-- são de teste de junho/agosto e não representam uso real.
DROP POLICY IF EXISTS violations_insert ON public.violations;
CREATE POLICY violations_insert ON public.violations
  FOR INSERT TO public
  WITH CHECK (can_moderate_content(user_id));


-- ── Camada 3 · a escalação automática NUNCA alcança a equipe ────────────────
--
-- Esta é a camada que vale mesmo que as outras duas caiam, e o motivo de ela
-- existir é concreto: `service_role` **ignora RLS**. Uma Edge Function de
-- moderação, hoje ou amanhã, escreve em `violations` sem passar pela camada 2.
--
-- A regra de produto, escrita aqui porque tem que estar escrita em algum lugar
-- (§5): **membro da equipe só é punido por decisão humana com hierarquia.**
-- Ban e suspensão de staff têm caminho próprio (`ban_user`, `apply_suspension`)
-- e esses caminhos já comparam cargos.
--
-- E o `RETURN` é BARULHENTO, não mudo (§1.5). Sair em silêncio criaria a versão
-- boa do mesmo problema: a equipe nunca saberia que alguém acumulou pontos
-- suficientes para ser banido — que é informação de segurança, não ruído.
CREATE OR REPLACE FUNCTION public.apply_mod_auto_ban(p_user_id uuid, p_points integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_username text; v_role text;
BEGIN
  SELECT username, role INTO v_username, v_role FROM profiles WHERE id = p_user_id;
  IF v_username IS NULL THEN RETURN; END IF;

  IF role_rank(v_role) >= 2 THEN
    INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
    VALUES ('auto_ban_barrado',
      'Escalacao automatica NAO baniu @' || v_username || ' (' || v_role || ', ' || p_points || ' pontos): '
        || 'membro da equipe so e banido por decisao humana com hierarquia.',
      'security', NULL, 'Sistema', 'warning',
      jsonb_build_object('target_id', p_user_id, 'target_username', v_username,
                         'target_role', v_role, 'points', p_points),
      NULL, 'Sistema');
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN RETURN; END IF;

  UPDATE profiles SET
    banned             = true,
    ban_reason         = 'Banimento automático — limite de infrações atingido (' || p_points || ' pontos)',
    banned_by_username = 'Sistema',
    banned_at          = now(),
    ban_count          = ban_count + 1
  WHERE id = p_user_id;

  UPDATE posts SET deleted_at = now() WHERE user_id = p_user_id AND deleted_at IS NULL;
  DELETE FROM comments        WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat       WHERE user_id = p_user_id;

  INSERT INTO admin_logs
    (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_ban',
    '@' || v_username || ' banido automaticamente pelo sistema (' || p_points || ' pontos de infrações)',
    'security', NULL, 'Sistema', 'critical',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_username, 'points', p_points),
    NULL, 'Sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_ban', 'Banimento automático',
    '@' || v_username || ' foi banido automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins',
    jsonb_build_object('target_username', v_username, 'points', p_points));
END;
$fn$;


CREATE OR REPLACE FUNCTION public.apply_mod_auto_suspend(p_user_id uuid, p_points integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_username text; v_role text; v_until timestamptz := now() + interval '7 days';
BEGIN
  SELECT username, role INTO v_username, v_role FROM profiles WHERE id = p_user_id;
  IF v_username IS NULL THEN RETURN; END IF;

  IF role_rank(v_role) >= 2 THEN
    INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
    VALUES ('auto_suspend_barrado',
      'Escalacao automatica NAO suspendeu @' || v_username || ' (' || v_role || ', ' || p_points || ' pontos): '
        || 'membro da equipe so e suspenso por decisao humana com hierarquia.',
      'security', NULL, 'Sistema', 'warning',
      jsonb_build_object('target_id', p_user_id, 'target_username', v_username,
                         'target_role', v_role, 'points', p_points),
      NULL, 'Sistema');
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id
             AND (banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))) THEN
    RETURN;
  END IF;

  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_suspend', '@' || v_username || ' suspenso automaticamente pelo sistema (' || p_points || ' pontos)',
    'security', NULL, 'Sistema', 'warning',
    jsonb_build_object('target_id', p_user_id, 'points', p_points, 'until', v_until), NULL, 'Sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_suspend', 'Suspensão automática',
    '@' || v_username || ' foi suspenso automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins', jsonb_build_object('target_username', v_username, 'points', p_points));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua conta foi suspensa automaticamente por acúmulo de infrações. Você volta a poder publicar em ' ||
    to_char(v_until, 'DD/MM/YYYY HH24:MI') || '.');
END;
$fn$;
