-- ─── site_config table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- everyone can read (banner + maintenance gate runs client-side)
CREATE POLICY "site_config_select_all" ON public.site_config
  FOR SELECT USING (true);

-- only owner can write directly
CREATE POLICY "site_config_owner_all" ON public.site_config
  FOR ALL
  USING  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

-- default rows
INSERT INTO public.site_config (key, value) VALUES
  ('banner_enabled',  'false'),
  ('banner_text',     ''),
  ('banner_color',    'orange'),
  ('maintenance_mode','false')
ON CONFLICT (key) DO NOTHING;

-- ─── owner_get_stats ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result        JSONB;
  daily_signups JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('date', to_char(d.dt, 'YYYY-MM-DD'), 'count', COALESCE(c.cnt, 0))
    ORDER BY d.dt
  ) INTO daily_signups
  FROM generate_series(
    (CURRENT_DATE - INTERVAL '13 days')::timestamp,
    CURRENT_DATE::timestamp,
    '1 day'::interval
  ) AS d(dt)
  LEFT JOIN (
    SELECT DATE(created_at) AS dt, COUNT(*)::int AS cnt
    FROM profiles
    WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
    GROUP BY DATE(created_at)
  ) c ON DATE(d.dt) = c.dt;

  SELECT jsonb_build_object(
    'total_users',         (SELECT COUNT(*)           FROM profiles),
    'admins',              (SELECT COUNT(*)           FROM profiles WHERE role IN ('admin','super_admin')),
    'super_admins',        (SELECT COUNT(*)           FROM profiles WHERE role = 'super_admin'),
    'banned_users',        (SELECT COUNT(*)           FROM profiles WHERE banned = true),
    'total_posts',         (SELECT COUNT(*)           FROM posts),
    'posts_today',         (SELECT COUNT(*)           FROM posts WHERE created_at >= CURRENT_DATE),
    'posts_week',          (SELECT COUNT(*)           FROM posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'total_comments',      (SELECT COUNT(*)           FROM comments),
    'total_keys',          (SELECT COUNT(*)           FROM game_keys WHERE is_promo = false),
    'active_lives',        (SELECT COUNT(*)           FROM posts WHERE is_live = true),
    'total_community',     (SELECT COUNT(*)           FROM community_posts),
    'users_today',         (SELECT COUNT(*)           FROM profiles WHERE created_at >= CURRENT_DATE),
    'users_week',          (SELECT COUNT(*)           FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'daily_signups',       daily_signups
  ) INTO result;

  RETURN result;
END;
$$;

-- ─── owner_get_users ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_users()
RETURNS TABLE (
  id            UUID,
  username      TEXT,
  role          TEXT,
  banned        BOOLEAN,
  ban_count     INT,
  created_at    TIMESTAMPTZ,
  post_count    BIGINT,
  comment_count BIGINT,
  xp            BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username::TEXT,
    p.role::TEXT,
    COALESCE(p.banned, false),
    COALESCE(p.ban_count, 0),
    p.created_at,
    COALESCE(pc.post_count,    0)::BIGINT,
    COALESCE(cc.comment_count, 0)::BIGINT,
    (
      COALESCE(pc.regular_posts, 0) * 20 +
      COALESCE(pc.live_posts,    0) * 50 +
      COALESCE(lc.like_count,    0) * 5  +
      COALESCE(cc.comment_count, 0) * 3  +
      CASE WHEN p.bio        IS NOT NULL AND p.bio        <> '' THEN 10 ELSE 0 END +
      CASE WHEN p.avatar_url IS NOT NULL                        THEN 15 ELSE 0 END +
      CASE WHEN p.platform   IS NOT NULL                        THEN  5 ELSE 0 END +
      CASE WHEN p.discord    IS NOT NULL AND p.discord    <> '' THEN 10 ELSE 0 END +
      CASE WHEN p.twitch     IS NOT NULL AND p.twitch     <> '' THEN 10 ELSE 0 END +
      CASE WHEN p.youtube    IS NOT NULL AND p.youtube    <> '' THEN 10 ELSE 0 END
    )::BIGINT
  FROM profiles p
  LEFT JOIN (
    SELECT user_id,
      COUNT(*)                           AS post_count,
      COUNT(*) FILTER (WHERE NOT was_live) AS regular_posts,
      COUNT(*) FILTER (WHERE was_live)     AS live_posts
    FROM posts
    GROUP BY user_id
  ) pc ON pc.user_id = p.id
  LEFT JOIN (
    SELECT po.user_id, COUNT(*) AS like_count
    FROM post_likes l
    JOIN posts po ON po.id = l.post_id
    GROUP BY po.user_id
  ) lc ON lc.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS comment_count
    FROM comments
    GROUP BY user_id
  ) cc ON cc.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- ─── owner_set_role ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_set_role(p_target_user_id UUID, p_new_role TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_username TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado — apenas o fundador pode alterar roles.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível alterar a própria role.';
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Role inválida: %', p_new_role;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Não é possível alterar a role do fundador.';
  END IF;

  SELECT username INTO v_owner_username FROM profiles WHERE id = auth.uid();

  UPDATE profiles SET role = p_new_role WHERE id = p_target_user_id;

  INSERT INTO admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  SELECT auth.uid(), v_owner_username, auth.uid(), v_owner_username,
    'set_role',
    'Role alterada para ' || p_new_role || ' pelo fundador',
    'admin', 'info';
END;
$$;

-- ─── owner_set_site_config ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_set_site_config(p_key TEXT, p_value TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  INSERT INTO site_config (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = p_value, updated_at = now(), updated_by = auth.uid();
END;
$$;

-- ─── owner_get_audit_logs ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_audit_logs(
  p_limit    INT     DEFAULT 30,
  p_offset   INT     DEFAULT 0,
  p_category TEXT    DEFAULT NULL,
  p_severity TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  actor_username TEXT,
  action         TEXT,
  details        TEXT,
  category       TEXT,
  severity       TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    COALESCE(l.actor_username, l.admin_username),
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
;
