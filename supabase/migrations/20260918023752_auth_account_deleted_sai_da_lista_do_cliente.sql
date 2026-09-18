-- `[18/09]` `auth_account_deleted` sai da lista que o cliente pode registrar.
--
-- ── Uma entrada morta que EU criei ─────────────────────────────────────────
--
-- O SEC-012 (12/09) moveu a gravacao para DENTRO da `delete_own_account`, que e
-- `SECURITY DEFINER` e grava direto em `admin_logs`. A action continuou na
-- lista de `c_proprias` do `log_audit_event`, onde nao serve mais a ninguem.
--
-- ── O que ela permite hoje ─────────────────────────────────────────────────
--
-- Qualquer pessoa logada chama `log_audit_event('auth_account_deleted', ...)` e
-- planta na trilha de auditoria um registro de que apagou a conta — **sem ter
-- apagado nada**. Nao da poder, nao expoe dado, nao quebra tela.
--
-- **O estrago e na trilha.** Ela existe para responder "o que aconteceu, e
-- quem fez", e o §5 do BANCO.md e explicito sobre isso: acao que nao deixa
-- rastro faz "a trilha de auditoria do dono mentir por omissao". Uma linha
-- forjavel faz a trilha mentir por COMISSAO, que e pior — omissao deixa um
-- buraco, comissao escreve ficcao com cara de fato.
--
-- ── O caminho legitimo continua intacto ────────────────────────────────────
--
-- Quem apaga a conta de verdade chama `delete_own_account(p_senha)`, que
-- confere a senha no servidor e grava o log por dentro. Essa funcao NAO passa
-- por aqui, entao esta mudanca nao a alcanca.
--
-- Nada mais sai da lista: as outras 19 de `c_proprias` sao registradas pelo
-- cliente de verdade, e `logAudit` engole erro de proposito — tirar uma que
-- esta em uso apagaria o registro em silencio.

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text, p_details text, p_category text DEFAULT 'auth'::text,
  p_severity text DEFAULT 'info'::text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid; v_username text;
  -- Qualquer pessoa logada registra estas sobre o próprio uso do site.
  --
  -- `[18/09]` `auth_account_deleted` SAIU: desde o SEC-012 quem grava é a
  -- própria `delete_own_account`, por dentro. Aqui ela só permitia plantar na
  -- trilha um "apaguei minha conta" de quem não apagou nada.
  c_proprias constant text[] := ARRAY[
    'auth_login_success','auth_logout','auth_password_changed',
    'auth_email_change_requested',
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
