-- FASE 2 da auditoria: dois achados nas funções `SECURITY DEFINER`.
--
-- ══ ACHADO 1 · O FUNDADOR era barrado do painel de logins bloqueados ════════
--
-- `get_blocked_logins` checava `role = 'super_admin'` LITERAL. O `owner`, que
-- está ACIMA dele na hierarquia, recebia "Access denied: super_admin required".
-- Comprovado em ROLLBACK assumindo o JWT do fundador de verdade.
--
-- Terceira reincidência da mesma classe: 14 policies sem `owner`, o
-- `admin_unlock_login` barrando o fundador, e agora esta. A regra existe e está
-- escrita (§1.3, "hierarquia nunca se escreve à mão") — o que a fez falhar de
-- novo foi ninguém ter varrido as FUNÇÕES com o critério com que se varreu as
-- policies. `is_super()` é `role_rank(...) >= 3`.
--
-- ══ ACHADO 2 · A trilha de auditoria era FORJÁVEL por quem tem conta ════════
--
-- COMPROVADO EM ROLLBACK: um perfil `role = 'user'` gravou
-- `action = 'admin_ban'`, `details = '@vitima foi banida'`,
-- `severity = 'critical'` em `admin_logs`.
--
-- O `actor_id` sempre foi honesto (vem de `auth.uid()`), mas todo o resto vinha
-- do cliente. O estrago não é escalar privilégio: é envenenar a fonte de
-- verdade da moderação e disparar alarme falso de propósito.
--
-- Três travas: lista FECHADA de actions, cargo para as de equipe, e severidade
-- alta só de equipe (o cliente comum só usa `info` e `warning` — medido).
--
-- O que NÃO entrou na lista de equipe é decisão, não esquecimento:
-- `post_deleted`, `comment_deleted`, `mural_delete`, `live_chat_delete` e
-- `live_silence` ficaram nas "próprias", porque o dono do post, do comentário,
-- da mensagem e da LIVE moderam o que é deles sem ser equipe
-- (`canModerateLive`). Exigir cargo ali perderia registro legítimo EM SILÊNCIO,
-- porque `logAudit` engole o erro. Daí a trava real ser o teste
-- `trilhaNaoEhForjavel.test.js`, que reprova no CI.
CREATE OR REPLACE FUNCTION public.get_blocked_logins()
RETURNS TABLE(email text, attempts integer, blocked_until timestamptz,
              permanent boolean, currently_blocked boolean,
              updated_at timestamptz, username text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT is_super() THEN
    RAISE EXCEPTION 'Acesso negado: exige super_admin ou fundador.';
  END IF;
  RETURN QUERY
  SELECT la.email, la.attempts, la.blocked_until, la.permanent,
         true AS currently_blocked, la.updated_at, p.username
    FROM public.login_attempts la
    LEFT JOIN auth.users     au ON au.email = la.email
    LEFT JOIN public.profiles p ON p.id     = au.id
   WHERE la.permanent OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())
   ORDER BY la.permanent DESC, la.updated_at DESC;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text, p_details text,
  p_category text DEFAULT 'auth'::text,
  p_severity text DEFAULT 'info'::text,
  p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid uuid; v_username text;
  -- Qualquer pessoa logada registra estas sobre o próprio uso do site.
  c_proprias constant text[] := ARRAY[
    'auth_login_success','auth_logout','auth_password_changed',
    'auth_email_change_requested','auth_account_deleted',
    'post_edited','post_deleted','comment_added','comment_deleted',
    'profile_updated','profile_avatar_updated','mural_post','mural_delete',
    'live_created','live_ended','live_chat_delete','live_silence','live_unsilence',
    'reactivation_requested'];
  -- Estas só nascem nos painéis. Exigem cargo.
  c_de_equipe constant text[] := ARRAY[
    'admin_add_key','admin_delete_key','admin_delete_post','admin_delete_posts',
    'admin_permanent_delete_all','admin_permanent_delete_post',
    'admin_restore_post','admin_unlock_login','admin_unsilence_chat',
    'live_reactivated','reactivation_approved','reactivation_denied',
    'site_config_changed','wordlist_added','wordlist_removed'];
BEGIN
  IF NOT (p_action = ANY(c_proprias) OR p_action = ANY(c_de_equipe)) THEN
    RAISE EXCEPTION 'Action "%" nao pode ser registrada pelo cliente.', p_action;
  END IF;
  IF p_action = ANY(c_de_equipe) AND NOT is_staff() THEN
    RAISE EXCEPTION 'Action "%" e de equipe e voce nao e equipe.', p_action;
  END IF;
  IF p_severity IN ('critical','high') AND NOT is_staff() THEN
    RAISE EXCEPTION 'Severidade "%" nao pode vir do cliente comum.', p_severity;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
  END IF;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username,
                          severity, metadata, admin_id, admin_username)
  VALUES (p_action, p_details, p_category, v_uid, COALESCE(v_username,'anônimo'),
          p_severity, p_metadata, v_uid, COALESCE(v_username,'sistema'));
END;
$fn$;

COMMENT ON FUNCTION public.log_audit_event(text,text,text,text,jsonb) IS
  'Trilha de auditoria escrita pelo cliente. Lista FECHADA de actions, cargo '
  'exigido para as de equipe, e severidade alta só de equipe — antes disso '
  'qualquer pessoa logada forjava "admin_ban" com severity critical.';
