CREATE OR REPLACE FUNCTION public.cleanup_old_data()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_logs    bigint;
  v_notifs  bigint;
  v_logins  bigint;
  v_chat    bigint;
BEGIN
  -- Auditoria administrativa: 90 dias é bem mais do que qualquer investigação
  -- retroativa que o painel permite consultar.
  DELETE FROM admin_logs WHERE created_at < now() - interval '90 days';
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

  RETURN jsonb_build_object(
    'admin_logs', v_logs,
    'notifications', v_notifs,
    'login_attempts', v_logins,
    'live_chat', v_chat
  );
END;
$function$;

-- Só o banco (pg_cron / SQL Editor) chama isto — nunca o cliente.
REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC, anon, authenticated;;
