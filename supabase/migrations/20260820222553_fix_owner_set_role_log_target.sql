CREATE OR REPLACE FUNCTION public.owner_set_role(p_target_user_id uuid, p_new_role text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner_username TEXT; v_target_username TEXT; v_old_role TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado — apenas o fundador pode alterar roles.';
  END IF;
  IF p_target_user_id = auth.uid() THEN RAISE EXCEPTION 'Não é possível alterar a própria role.'; END IF;
  IF p_new_role NOT IN ('user','admin','super_admin') THEN RAISE EXCEPTION 'Role inválida: %', p_new_role; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Não é possível alterar a role do fundador.';
  END IF;

  SELECT username INTO v_owner_username FROM profiles WHERE id = auth.uid();
  SELECT username, role INTO v_target_username, v_old_role FROM profiles WHERE id = p_target_user_id;

  UPDATE profiles SET role = p_new_role, role_changed_at = now() WHERE id = p_target_user_id;

  INSERT INTO admin_logs (admin_id, admin_username, actor_id, actor_username,
                          action, details, category, severity, metadata)
  VALUES (auth.uid(), v_owner_username, auth.uid(), v_owner_username, 'set_role',
    'Role de @' || COALESCE(v_target_username, '?') || ' alterada de ' ||
      COALESCE(v_old_role, '?') || ' para ' || p_new_role || ' pelo fundador',
    'admin', 'info',
    jsonb_build_object('target_id', p_target_user_id, 'target_username', v_target_username,
                       'from_role', v_old_role, 'to_role', p_new_role));
END;
$function$;;
