-- Corrige "column reference id is ambiguous" em owner_get_audit_logs e owner_get_notifications
-- O problema: dentro de funções com RETURNS TABLE(id ...), o PostgreSQL não sabe
-- se "id" no WHERE se refere à coluna da tabela ou à coluna de retorno.
-- Fix: qualificar sempre como profiles.id / profiles.role

CREATE OR REPLACE FUNCTION public.owner_get_audit_logs(
  p_limit    INT  DEFAULT 30,
  p_offset   INT  DEFAULT 0,
  p_category TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL
)
RETURNS TABLE(
  id uuid, actor_username text, action text, details text,
  category text, severity text, metadata jsonb, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    COALESCE(l.actor_username, l.admin_username)::TEXT,
    l.action,
    l.details,
    l.category,
    l.severity,
    l.metadata,
    l.created_at
  FROM admin_logs l
  WHERE (p_category IS NULL OR l.category = p_category)
    AND (p_severity IS NULL OR l.severity = p_severity)
  ORDER BY l.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_get_notifications(p_limit INT DEFAULT 50)
RETURNS TABLE(
  id uuid, kind text, actor text, action text, body text,
  severity text, category text, metadata jsonb, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
        'sistema'::TEXT AS actor,
        n.type::TEXT AS action,
        n.message::TEXT AS body,
        'info'::TEXT AS severity,
        'notification'::TEXT AS category,
        n.metadata,
        n.created_at
      FROM admin_notifications n
      WHERE n.type IN ('new_user','new_live','live_ended','user_banned')
      ORDER BY n.created_at DESC
      LIMIT 20
    )
  ) combined
  ORDER BY combined.created_at DESC
  LIMIT p_limit;
END;
$$;
;
