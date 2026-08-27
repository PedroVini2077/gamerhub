-- Permite que admin_notifications tenha audience = 'owner' (alertas diretos de staff pro fundador)
ALTER TABLE admin_notifications DROP CONSTRAINT admin_notifications_audience_check;
ALTER TABLE admin_notifications ADD CONSTRAINT admin_notifications_audience_check
  CHECK (audience = ANY (ARRAY['all_admins'::text, 'super_admin'::text, 'owner'::text]));

-- RPC: admin/super_admin envia alerta direto ao fundador (instabilidade no site / no painel)
CREATE FUNCTION public.notify_owner(p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text;
  v_username text;
BEGIN
  SELECT role, username INTO v_role, v_username
  FROM profiles WHERE id = auth.uid();

  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF length(trim(coalesce(p_message, ''))) < 10 THEN
    RAISE EXCEPTION 'Descreva o problema com pelo menos 10 caracteres.';
  END IF;

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES (
    'staff_alert',
    'Alerta de @' || v_username,
    trim(p_message),
    'owner',
    jsonb_build_object('sender_id', auth.uid(), 'sender_username', v_username, 'sender_role', v_role)
  );
END;
$function$;

-- Estende owner_get_notifications pra trazer alertas de staff (com remetente como actor)
CREATE OR REPLACE FUNCTION public.owner_get_notifications(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, kind text, actor text, action text, body text, severity text, category text, metadata jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    (
      SELECT
        l.id,
        CASE
          WHEN l.action = 'admin_ban'   THEN 'ban'
          WHEN l.action = 'admin_unban' THEN 'unban'
          WHEN l.action = 'set_role'    THEN 'role_change'
          WHEN l.severity = 'critical'  THEN 'alert'
          WHEN l.action ILIKE '%delete%' THEN 'delete'
          ELSE 'activity'
        END::TEXT AS kind,
        COALESCE(l.actor_username, l.admin_username, 'sistema')::TEXT AS actor,
        l.action::TEXT,
        l.details::TEXT AS body,
        l.severity::TEXT,
        l.category::TEXT,
        l.metadata,
        l.created_at
      FROM admin_logs l
      WHERE l.action IN ('admin_ban','admin_unban','set_role')
         OR l.severity = 'critical'
         OR (l.severity = 'warning' AND l.category = 'security')
      ORDER BY l.created_at DESC
      LIMIT 40
    )
    UNION ALL
    (
      SELECT
        n.id,
        n.type::TEXT AS kind,
        CASE
          WHEN n.type = 'staff_alert' THEN COALESCE(n.metadata->>'sender_username', 'staff')
          ELSE 'sistema'
        END::TEXT AS actor,
        n.type::TEXT AS action,
        n.message::TEXT AS body,
        CASE WHEN n.type = 'staff_alert' THEN 'warning' ELSE 'info' END::TEXT AS severity,
        'notification'::TEXT AS category,
        n.metadata,
        n.created_at
      FROM admin_notifications n
      WHERE n.type IN ('new_user','new_live','live_ended','user_banned','staff_alert')
      ORDER BY n.created_at DESC
      LIMIT 20
    )
  ) combined
  ORDER BY combined.created_at DESC
  LIMIT p_limit;
END;
$function$;
;
