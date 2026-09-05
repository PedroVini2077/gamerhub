-- ─────────────────────────────────────────────────────────────────────────────
-- Os prazos de retenção, decididos pelo dono em 02/09
--
-- Contexto: a LGPD tem um princípio de **necessidade** — dado só pode ficar
-- guardado enquanto serve para alguma coisa. Três tabelas do site guardam dado
-- pessoal e cresciam sem prazo nenhum.
--
-- O risco não era hipotético: se o banco vazasse daqui a dois anos, vazaria
-- junto TODO e-mail que já tentou entrar no site — inclusive de quem nunca
-- criou conta e só errou o endereço.
--
-- | Tabela            | Prazo   | Por que este número |
-- | ---               | ---     | --- |
-- | `login_attempts`  | 30 dias | serve para barrar ataque EM ANDAMENTO; tentativa de três meses atrás não protege nada. Já era 30 |
-- | `admin_logs`      | 1 ano   | precisa sobreviver a alguém questionar um banimento. 90 dias era curto para trilha de punição |
-- | `contact_messages`| 2 anos  | conversa de moderação; apagar cedo demais atrapalha a própria moderação |
--
-- ── O que este `UPDATE` NÃO toca, e é deliberado ────────────────────────────
--
-- Bloqueio de login **permanente** nunca é apagado, mesmo depois de anos: ele
-- é decisão de moderação, não lixo acumulado. Testado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_logs bigint; v_notifs bigint; v_logins bigint; v_chat bigint; v_contatos bigint;
BEGIN
  -- `[02/09]` 90 -> 365 dias. A trilha precisa sustentar uma decisão de
  -- moderação questionada meses depois; 90 dias não cobria um ban de janeiro
  -- discutido em maio. O número está espelhado em `LOG_RETENTION_DAYS`
  -- (`src/lib/logMeta.js`), e um teste falha se os dois divergirem.
  DELETE FROM admin_logs WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  -- Notificação já lida e velha não é mostrada em lugar nenhum.
  DELETE FROM notifications
   WHERE read = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_notifs = ROW_COUNT;

  -- Tentativas de login que não estão mais bloqueando ninguém. Bloqueio
  -- PERMANENTE nunca é apagado (é decisão de moderação, não lixo).
  DELETE FROM login_attempts
   WHERE permanent = false
     AND (blocked_until IS NULL OR blocked_until < now())
     AND updated_at < now() - interval '30 days';
  GET DIAGNOSTICS v_logins = ROW_COUNT;

  -- Chat de live já encerrada. A live em andamento nunca é tocada.
  DELETE FROM live_chat lc
   USING posts p
   WHERE p.id = lc.post_id
     AND p.is_live = false
     AND lc.created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_chat = ROW_COUNT;

  -- `[02/09]` A tabela nasceu em 02/09 sem prazo, e é a que guarda o dado mais
  -- sensível dos três: nome, e-mail e o relato de quem escreveu — inclusive de
  -- gente que não tem conta aqui.
  DELETE FROM contact_messages WHERE created_at < now() - interval '730 days';
  GET DIAGNOSTICS v_contatos = ROW_COUNT;

  RETURN jsonb_build_object(
    'admin_logs', v_logs,
    'notifications', v_notifs,
    'login_attempts', v_logins,
    'live_chat', v_chat,
    'contact_messages', v_contatos
  );
END $fn$;
