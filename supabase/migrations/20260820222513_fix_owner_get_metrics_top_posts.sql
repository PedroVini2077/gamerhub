CREATE OR REPLACE FUNCTION public.owner_get_metrics()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE result JSONB; top_posts JSONB; top_users JSONB; active_count BIGINT; inactive_count BIGINT; total_xp BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT jsonb_agg(t) INTO top_posts FROM (
    SELECT jsonb_build_object(
             'id', po.id, 'title', po.title,
             'likes', COALESCE(l.cnt, 0),
             'username', pr.username, 'created_at', po.created_at) AS t
    FROM posts po
    JOIN profiles pr ON pr.id = po.user_id
    LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id) l
           ON l.post_id = po.id
    WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND po.deleted_at IS NULL
    ORDER BY COALESCE(l.cnt, 0) DESC, po.created_at DESC
    LIMIT 10) sub;

  SELECT jsonb_agg(t) INTO top_users FROM (
    SELECT jsonb_build_object('username',p.username,'role',p.role,'post_count',COALESCE(pc.post_count,0),
      'xp',(COALESCE(pc.regular_posts,0)*20+COALESCE(pc.live_posts,0)*50+COALESCE(lc.like_count,0)*5+COALESCE(cc.comment_count,0)*3
            +CASE WHEN p.bio IS NOT NULL AND p.bio!='' THEN 10 ELSE 0 END+CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END
            +CASE WHEN p.platform IS NOT NULL THEN 5 ELSE 0 END+CASE WHEN p.discord IS NOT NULL AND p.discord!='' THEN 10 ELSE 0 END
            +CASE WHEN p.twitch IS NOT NULL AND p.twitch!='' THEN 10 ELSE 0 END+CASE WHEN p.youtube IS NOT NULL AND p.youtube!='' THEN 10 ELSE 0 END)) AS t
    FROM profiles p
    LEFT JOIN (SELECT user_id,COUNT(*) AS post_count,COUNT(*) FILTER(WHERE NOT was_live) AS regular_posts,COUNT(*) FILTER(WHERE was_live) AS live_posts FROM posts GROUP BY user_id) pc ON pc.user_id=p.id
    LEFT JOIN (SELECT po.user_id,COUNT(*) AS like_count FROM post_likes l JOIN posts po ON po.id=l.post_id GROUP BY po.user_id) lc ON lc.user_id=p.id
    LEFT JOIN (SELECT user_id,COUNT(*) AS comment_count FROM comments GROUP BY user_id) cc ON cc.user_id=p.id
    WHERE p.role!='owner' ORDER BY 1 DESC LIMIT 10) sub;

  SELECT COUNT(DISTINCT uid) INTO active_count FROM (SELECT user_id AS uid FROM posts WHERE created_at>=CURRENT_DATE-INTERVAL '7 days' UNION SELECT user_id FROM comments WHERE created_at>=CURRENT_DATE-INTERVAL '7 days') acts;
  SELECT COUNT(*) INTO inactive_count FROM profiles p WHERE p.created_at<CURRENT_DATE-INTERVAL '30 days' AND p.role!='owner'
    AND NOT EXISTS(SELECT 1 FROM posts WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days')
    AND NOT EXISTS(SELECT 1 FROM comments WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days');

  RETURN jsonb_build_object('top_posts',COALESCE(top_posts,'[]'::jsonb),'top_users',COALESCE(top_users,'[]'::jsonb),
    'active_7d',active_count,'inactive_30d',inactive_count,'total_xp',total_xp);
END;
$function$;;
