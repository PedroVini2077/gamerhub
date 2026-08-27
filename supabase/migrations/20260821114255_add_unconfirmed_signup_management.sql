-- Visibilidade + limpeza de cadastros que nunca confirmaram o email.
-- O trigger handle_new_user cria a linha em profiles no INSERT de auth.users,
-- ou seja, ANTES de qualquer confirmação — email inválido/inexistente vira
-- um "usuário" completo no admin, e o username fica reservado pra sempre.

CREATE OR REPLACE FUNCTION public.admin_get_unconfirmed_users()
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
           'id', p.id, 'username', p.username, 'email', u.email,
           'created_at', u.created_at,
           'days_pending', EXTRACT(DAY FROM now() - u.created_at)::int
         ) ORDER BY u.created_at)
    INTO result
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.confirmed_at IS NULL;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_get_unconfirmed_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_unconfirmed_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_unconfirmed_user(p_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_username text; v_target_username text; v_email text;
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT username INTO v_caller_username FROM profiles WHERE id = auth.uid();
  SELECT p.username, u.email INTO v_target_username, v_email
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_user_id AND u.confirmed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada ou já confirmada — use o painel normal de usuários pra essa.';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, admin_id, admin_username, severity, metadata)
  VALUES ('admin_delete_unconfirmed', '@' || v_caller_username || ' removeu cadastro nunca confirmado: @' || v_target_username || ' (' || v_email || ')',
    'admin', auth.uid(), v_caller_username, auth.uid(), v_caller_username, 'info',
    jsonb_build_object('target_username', v_target_username, 'email', v_email));
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_delete_unconfirmed_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_unconfirmed_user(uuid) TO authenticated;

-- Limpeza automática: cadastro nunca confirmado depois de 7 dias é lixo —
-- ninguém vai confirmar um email que nem existe. Libera o username.
CREATE OR REPLACE FUNCTION public.cleanup_unconfirmed_signups()
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count bigint;
BEGIN
  DELETE FROM auth.users
   WHERE confirmed_at IS NULL
     AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('unconfirmed_removed', v_count);
END;
$function$;
REVOKE ALL ON FUNCTION public.cleanup_unconfirmed_signups() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamerhub-cleanup-unconfirmed') THEN
      PERFORM cron.unschedule('gamerhub-cleanup-unconfirmed');
    END IF;
    PERFORM cron.schedule('gamerhub-cleanup-unconfirmed', '30 4 * * *', 'SELECT public.cleanup_unconfirmed_signups();');
  END IF;
END $$;;
