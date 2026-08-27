-- Drop funções que mudam de assinatura
DROP FUNCTION IF EXISTS public.owner_get_users();
DROP FUNCTION IF EXISTS public.owner_get_notifications(INT);

-- ─── 1. Fix unban_user para aceitar owner ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_caller_role     text;
  v_caller_username text;
  v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'owner') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban',
    '@' || v_target_username || ' foi desbanido por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$$;

-- ─── 2. Owner pode ler admin_logs diretamente ─────────────────────────────────
DROP POLICY IF EXISTS "owner_select_logs" ON public.admin_logs;
CREATE POLICY "owner_select_logs" ON public.admin_logs
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

-- ─── 3. owner_get_stats (posts_30d, keys_today) ──────────────────────────────
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
    'total_users',     (SELECT COUNT(*) FROM profiles),
    'admins',          (SELECT COUNT(*) FROM profiles WHERE role IN ('admin','super_admin')),
    'super_admins',    (SELECT COUNT(*) FROM profiles WHERE role = 'super_admin'),
    'banned_users',    (SELECT COUNT(*) FROM profiles WHERE banned = true),
    'total_posts',     (SELECT COUNT(*) FROM posts),
    'posts_today',     (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE),
    'posts_week',      (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'posts_30d',       (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'total_comments',  (SELECT COUNT(*) FROM comments),
    'total_keys',      (SELECT COUNT(*) FROM game_keys WHERE is_promo = false),
    'keys_today',      (SELECT COUNT(*) FROM game_keys WHERE created_at >= CURRENT_DATE),
    'active_lives',    (SELECT COUNT(*) FROM posts WHERE is_live = true),
    'total_community', (SELECT COUNT(*) FROM community_posts),
    'users_today',     (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'users_week',      (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'daily_signups',   daily_signups
  ) INTO result;

  RETURN result;
END;
$$;

-- ─── 4. owner_get_users (email + campos de ban) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_users()
RETURNS TABLE (
  id                 UUID,
  username           TEXT,
  email              TEXT,
  role               TEXT,
  banned             BOOLEAN,
  ban_count          INT,
  ban_reason         TEXT,
  ban_details        TEXT,
  banned_by_username TEXT,
  banned_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ,
  post_count         BIGINT,
  comment_count      BIGINT,
  xp                 BIGINT
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
    COALESCE(u.email, '')::TEXT,
    p.role::TEXT,
    COALESCE(p.banned, false),
    COALESCE(p.ban_count, 0),
    p.ban_reason::TEXT,
    p.ban_details::TEXT,
    p.banned_by_username::TEXT,
    p.banned_at,
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
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN (
    SELECT user_id,
      COUNT(*)                             AS post_count,
      COUNT(*) FILTER (WHERE NOT was_live) AS regular_posts,
      COUNT(*) FILTER (WHERE was_live)     AS live_posts
    FROM posts GROUP BY user_id
  ) pc ON pc.user_id = p.id
  LEFT JOIN (
    SELECT po.user_id, COUNT(*) AS like_count
    FROM post_likes l JOIN posts po ON po.id = l.post_id
    GROUP BY po.user_id
  ) lc ON lc.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS comment_count
    FROM comments GROUP BY user_id
  ) cc ON cc.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- ─── 5. owner_get_metrics ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result         JSONB;
  top_posts      JSONB;
  top_users      JSONB;
  active_count   BIGINT;
  inactive_count BIGINT;
  total_xp       BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT jsonb_agg(t) INTO top_posts
  FROM (
    SELECT jsonb_build_object(
      'id', po.id, 'title', po.title, 'likes', po.likes,
      'username', pr.username, 'created_at', po.created_at
    ) AS t
    FROM posts po
    JOIN profiles pr ON pr.id = po.user_id
    WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY po.likes DESC LIMIT 10
  ) sub;

  SELECT jsonb_agg(t) INTO top_users
  FROM (
    SELECT jsonb_build_object(
      'username', p.username, 'role', p.role, 'post_count', COALESCE(pc.post_count, 0),
      'xp', (
        COALESCE(pc.regular_posts, 0)*20 + COALESCE(pc.live_posts,0)*50 +
        COALESCE(lc.like_count,0)*5 + COALESCE(cc.comment_count,0)*3 +
        CASE WHEN p.bio IS NOT NULL AND p.bio!='' THEN 10 ELSE 0 END +
        CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END +
        CASE WHEN p.platform IS NOT NULL THEN 5 ELSE 0 END +
        CASE WHEN p.discord IS NOT NULL AND p.discord!='' THEN 10 ELSE 0 END +
        CASE WHEN p.twitch IS NOT NULL AND p.twitch!='' THEN 10 ELSE 0 END +
        CASE WHEN p.youtube IS NOT NULL AND p.youtube!='' THEN 10 ELSE 0 END
      )
    ) AS t
    FROM profiles p
    LEFT JOIN (SELECT user_id, COUNT(*) AS post_count, COUNT(*) FILTER (WHERE NOT was_live) AS regular_posts, COUNT(*) FILTER (WHERE was_live) AS live_posts FROM posts GROUP BY user_id) pc ON pc.user_id=p.id
    LEFT JOIN (SELECT po.user_id, COUNT(*) AS like_count FROM post_likes l JOIN posts po ON po.id=l.post_id GROUP BY po.user_id) lc ON lc.user_id=p.id
    LEFT JOIN (SELECT user_id, COUNT(*) AS comment_count FROM comments GROUP BY user_id) cc ON cc.user_id=p.id
    WHERE p.role!='owner'
    ORDER BY (COALESCE(pc.regular_posts,0)*20+COALESCE(pc.live_posts,0)*50+COALESCE(lc.like_count,0)*5+COALESCE(cc.comment_count,0)*3+CASE WHEN p.bio IS NOT NULL AND p.bio!='' THEN 10 ELSE 0 END+CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END+CASE WHEN p.platform IS NOT NULL THEN 5 ELSE 0 END+CASE WHEN p.discord IS NOT NULL AND p.discord!='' THEN 10 ELSE 0 END+CASE WHEN p.twitch IS NOT NULL AND p.twitch!='' THEN 10 ELSE 0 END+CASE WHEN p.youtube IS NOT NULL AND p.youtube!='' THEN 10 ELSE 0 END) DESC
    LIMIT 10
  ) sub;

  SELECT COUNT(DISTINCT uid) INTO active_count FROM (SELECT user_id AS uid FROM posts WHERE created_at>=CURRENT_DATE-INTERVAL '7 days' UNION SELECT user_id FROM comments WHERE created_at>=CURRENT_DATE-INTERVAL '7 days') acts;

  SELECT COUNT(*) INTO inactive_count FROM profiles p WHERE p.created_at<CURRENT_DATE-INTERVAL '30 days' AND p.role!='owner' AND NOT EXISTS(SELECT 1 FROM posts WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days') AND NOT EXISTS(SELECT 1 FROM comments WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days');

  SELECT COALESCE(SUM(COALESCE(pc2.regular_posts,0)*20+COALESCE(pc2.live_posts,0)*50+COALESCE(lc2.like_count,0)*5+COALESCE(cc2.comment_count,0)*3+CASE WHEN p2.bio IS NOT NULL AND p2.bio!='' THEN 10 ELSE 0 END+CASE WHEN p2.avatar_url IS NOT NULL THEN 15 ELSE 0 END+CASE WHEN p2.platform IS NOT NULL THEN 5 ELSE 0 END+CASE WHEN p2.discord IS NOT NULL AND p2.discord!='' THEN 10 ELSE 0 END+CASE WHEN p2.twitch IS NOT NULL AND p2.twitch!='' THEN 10 ELSE 0 END+CASE WHEN p2.youtube IS NOT NULL AND p2.youtube!='' THEN 10 ELSE 0 END),0) INTO total_xp FROM profiles p2 LEFT JOIN(SELECT user_id,COUNT(*) AS post_count,COUNT(*) FILTER(WHERE NOT was_live) AS regular_posts,COUNT(*) FILTER(WHERE was_live) AS live_posts FROM posts GROUP BY user_id)pc2 ON pc2.user_id=p2.id LEFT JOIN(SELECT po.user_id,COUNT(*) AS like_count FROM post_likes l JOIN posts po ON po.id=l.post_id GROUP BY po.user_id)lc2 ON lc2.user_id=p2.id LEFT JOIN(SELECT user_id,COUNT(*) AS comment_count FROM comments GROUP BY user_id)cc2 ON cc2.user_id=p2.id WHERE p2.role!='owner';

  SELECT jsonb_build_object('top_posts',COALESCE(top_posts,'[]'::jsonb),'top_users',COALESCE(top_users,'[]'::jsonb),'active_7d',active_count,'inactive_30d',inactive_count,'total_xp',total_xp) INTO result;
  RETURN result;
END;
$$;

-- ─── 6. owner_get_notifications ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_notifications(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id         UUID,
  kind       TEXT,
  actor      TEXT,
  action     TEXT,
  body       TEXT,
  severity   TEXT,
  category   TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ
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
  SELECT * FROM (
    (
      SELECT l.id,
        CASE WHEN l.action='admin_ban' THEN 'ban' WHEN l.action='admin_unban' THEN 'unban' WHEN l.action='set_role' THEN 'role_change' WHEN l.severity='critical' THEN 'alert' WHEN l.action ILIKE '%delete%' THEN 'delete' ELSE 'activity' END::TEXT AS kind,
        COALESCE(l.actor_username,l.admin_username,'sistema')::TEXT AS actor,
        l.action::TEXT, l.details::TEXT AS body,
        l.severity::TEXT, l.category::TEXT, l.metadata, l.created_at
      FROM admin_logs l
      WHERE l.action IN ('admin_ban','admin_unban','set_role') OR l.severity='critical' OR (l.severity='warning' AND l.category='security')
      ORDER BY l.created_at DESC LIMIT 40
    )
    UNION ALL
    (
      SELECT n.id, n.type::TEXT AS kind, 'sistema'::TEXT AS actor, n.type::TEXT AS action, n.message::TEXT AS body,
        'info'::TEXT AS severity, 'notification'::TEXT AS category, n.metadata, n.created_at
      FROM admin_notifications n
      WHERE n.type IN ('new_user','new_live','live_ended','user_banned')
      ORDER BY n.created_at DESC LIMIT 20
    )
  ) combined
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

-- ─── 7. Feature flags defaults ────────────────────────────────────────────────
INSERT INTO public.site_config (key, value) VALUES
  ('feature_keys',      'true'),
  ('feature_lives',     'true'),
  ('feature_community', 'true')
ON CONFLICT (key) DO NOTHING;
;
