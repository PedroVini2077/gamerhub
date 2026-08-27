CREATE OR REPLACE FUNCTION get_user_xp(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_count    int := 0;
  v_total_likes   int := 0;
  v_comment_count int := 0;
  v_live_count    int := 0;
  v_profile_bonus int := 0;
  v_xp            int;
  v_profile       profiles%rowtype;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  -- Posts e likes totais
  SELECT COUNT(*), COALESCE(SUM(likes), 0)
  INTO v_post_count, v_total_likes
  FROM posts WHERE user_id = p_user_id;

  -- Comentários
  SELECT COUNT(*) INTO v_comment_count
  FROM comments WHERE user_id = p_user_id;

  -- Lives (já contadas em post_count — adicionamos apenas o bônus extra)
  SELECT COUNT(*) INTO v_live_count
  FROM posts WHERE user_id = p_user_id AND was_live = true;

  -- Bônus únicos de perfil
  IF v_profile.bio IS NOT NULL AND length(trim(v_profile.bio)) > 0 THEN
    v_profile_bonus := v_profile_bonus + 50;
  END IF;
  IF v_profile.avatar_url IS NOT NULL THEN
    v_profile_bonus := v_profile_bonus + 30;
  END IF;
  IF v_profile.platform IS NOT NULL THEN
    v_profile_bonus := v_profile_bonus + 15;
  END IF;
  IF v_profile.discord IS NOT NULL THEN
    v_profile_bonus := v_profile_bonus + 15;
  END IF;
  IF v_profile.twitch IS NOT NULL THEN
    v_profile_bonus := v_profile_bonus + 15;
  END IF;
  IF v_profile.youtube IS NOT NULL THEN
    v_profile_bonus := v_profile_bonus + 15;
  END IF;

  -- XP total
  -- Lives já entram como posts (+20) — adicionamos +30 de bônus = +50 total por live
  v_xp := (v_post_count * 20)
         + (v_total_likes * 5)
         + (v_comment_count * 3)
         + (v_live_count * 30)
         + v_profile_bonus;

  RETURN jsonb_build_object(
    'xp',            v_xp,
    'posts',         v_post_count,
    'likes',         v_total_likes,
    'comments',      v_comment_count,
    'lives',         v_live_count,
    'profile_bonus', v_profile_bonus
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_xp(uuid) TO authenticated, anon;
;
