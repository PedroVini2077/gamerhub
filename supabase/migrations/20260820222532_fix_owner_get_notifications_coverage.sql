CREATE OR REPLACE FUNCTION public.owner_get_notifications(p_limit integer DEFAULT 50)
  RETURNS TABLE(id uuid, kind text, actor text, action text, body text,
                severity text, category text, metadata jsonb, created_at timestamptz)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    (SELECT l.id,
      l.action::TEXT,
      COALESCE(l.actor_username, l.admin_username, 'sistema')::TEXT,
      l.action::TEXT, l.details::TEXT,
      l.severity::TEXT, l.category::TEXT, l.metadata, l.created_at
    FROM admin_logs l
    WHERE l.action IN (
            'admin_ban', 'admin_unban', 'admin_role_changed', 'set_role',
            'admin_unban_requested', 'admin_unban_approved', 'admin_unban_denied',
            'user_suspended', 'auto_ban', 'auto_suspend',
            'auth_banned_attempt', 'admin_unlock_login', 'auth_account_deleted'
          )
       OR l.severity = 'critical'
       OR (l.severity = 'warning' AND l.category = 'security')
    ORDER BY l.created_at DESC LIMIT 40)
    UNION ALL
    -- Sem whitelist de tipo: notificação de staff nova aparece automaticamente.
    (SELECT n.id, n.type::TEXT,
      CASE WHEN n.type = 'staff_alert'
           THEN COALESCE(n.metadata->>'sender_username', 'staff')
           ELSE 'sistema' END::TEXT,
      n.type::TEXT, n.message::TEXT,
      CASE WHEN n.type IN ('staff_alert', 'auto_ban', 'user_banned') THEN 'warning'
           ELSE 'info' END::TEXT,
      'notification'::TEXT, n.metadata, n.created_at
    FROM admin_notifications n
    ORDER BY n.created_at DESC LIMIT 30)
  ) combined
  ORDER BY combined.created_at DESC
  LIMIT p_limit;
END;
$function$;;
