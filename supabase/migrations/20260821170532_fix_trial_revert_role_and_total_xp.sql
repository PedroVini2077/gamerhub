-- F5 (BUG DE LÓGICA) — `decide_staff_trial` com decisão 'revert' rebaixava
-- para 'user' SEMPRE. Como `nominate_staff` exige que o candidato a
-- super_admin já seja admin, reverter a avaliação de um super_admin também
-- apagava o cargo de admin que a pessoa já tinha legitimamente antes da
-- promoção. Agora volta para o cargo anterior de verdade.
CREATE OR REPLACE FUNCTION public.decide_staff_trial(
    p_nomination_id uuid, p_decision text, p_notes text DEFAULT NULL, p_extend_days integer DEFAULT 15)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_nom staff_nominations%rowtype; v_candidate_username text; v_previous_role text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then
    raise exception 'Acesso negado: apenas super admins ou o fundador podem decidir sobre avaliações';
  end if;
  if p_decision not in ('confirm','extend','revert') then raise exception 'Decisão inválida: %', p_decision; end if;

  select * into v_nom from staff_nominations where id = p_nomination_id for update;
  if v_nom.id is null then raise exception 'Avaliação não encontrada'; end if;
  if v_nom.status <> 'trial_active' then raise exception 'Esta indicação não está em período de avaliação'; end if;
  if v_nom.nominated_by is not null and v_nom.nominated_by = v_caller_id then
    raise exception 'Acesso negado: você não pode decidir sobre uma avaliação que você mesmo indicou';
  end if;
  if v_nom.target_role = 'super_admin' and v_caller_role <> 'owner' then
    raise exception 'Acesso negado: avaliação de super admin só pode ser decidida pelo fundador';
  end if;

  select username into v_candidate_username from profiles where id = v_nom.candidate_id;

  if p_decision = 'extend' then
    if p_extend_days is null or p_extend_days < 1 then raise exception 'Extensão inválida'; end if;
    update staff_nominations
       set trial_review_date = trial_review_date + (p_extend_days || ' days')::interval,
           review_notes = coalesce(review_notes || E'\n', '') || '[Extensão +'||p_extend_days||'d por @'||v_caller_username||'] ' || coalesce(p_notes, '')
     where id = p_nomination_id;
    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_extended',
      'Avaliação de @'||v_candidate_username||' estendida em '||p_extend_days||' dias por @'||v_caller_username, 'admin', 'info');
    return;
  end if;

  if p_decision = 'confirm' then
    update staff_nominations
       set status = 'confirmed', final_decided_by = v_caller_id, final_decision_notes = p_notes, final_decided_at = now()
     where id = p_nomination_id;
    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_confirmed',
      'Avaliação de @'||v_candidate_username||' confirmada — cargo de '||v_nom.target_role||' efetivado por @'||v_caller_username, 'admin', 'info');
    return;
  end if;

  -- revert: volta ao cargo que a pessoa tinha ANTES da promoção.
  -- `nominate_staff` garante o par: admin <- user, super_admin <- admin.
  v_previous_role := case when v_nom.target_role = 'super_admin' then 'admin' else 'user' end;

  update staff_nominations
     set status = 'reverted', final_decided_by = v_caller_id, final_decision_notes = p_notes, final_decided_at = now()
   where id = p_nomination_id;

  update profiles set role = v_previous_role, role_changed_at = now() where id = v_nom.candidate_id;

  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_trial_reverted',
    'Avaliação de @'||v_candidate_username||' revertida por @'||v_caller_username||
    ' — cargo voltou para '||v_previous_role||coalesce('. Motivo: '||p_notes, ''), 'admin', 'warning');
end;
$function$;

-- F6 — `owner_get_metrics` declarava `total_xp` e devolvia a variável sem
-- nunca atribuir nada: o painel do fundador sempre mostrou XP total nulo.
CREATE OR REPLACE FUNCTION public.owner_get_metrics()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE top_posts JSONB; top_users JSONB; active_count BIGINT; inactive_count BIGINT; total_xp BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  SELECT jsonb_agg(t) INTO top_posts FROM (
    SELECT jsonb_build_object('id',po.id,'title',po.title,'likes',COALESCE(l.cnt,0),
             'username',pr.username,'created_at',po.created_at) AS t
    FROM posts po JOIN profiles pr ON pr.id = po.user_id
    LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id) l ON l.post_id = po.id
    WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days' AND po.deleted_at IS NULL
    ORDER BY COALESCE(l.cnt,0) DESC, po.created_at DESC LIMIT 10) sub;

  -- XP por usuário, na mesma fórmula usada no ranking — reaproveitada agora
  -- para o top_users E para o total.
  WITH xp AS (
    SELECT p.id, p.username, p.role,
      COALESCE(pc.post_count,0) AS post_count,
      (COALESCE(pc.regular_posts,0)*20 + COALESCE(pc.live_posts,0)*50
       + COALESCE(lc.like_count,0)*5 + COALESCE(cc.comment_count,0)*3
       + CASE WHEN p.bio IS NOT NULL AND p.bio!='' THEN 10 ELSE 0 END
       + CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END
       + CASE WHEN p.platform IS NOT NULL THEN 5 ELSE 0 END
       + CASE WHEN p.discord IS NOT NULL AND p.discord!='' THEN 10 ELSE 0 END
       + CASE WHEN p.twitch IS NOT NULL AND p.twitch!='' THEN 10 ELSE 0 END
       + CASE WHEN p.youtube IS NOT NULL AND p.youtube!='' THEN 10 ELSE 0 END) AS xp
    FROM profiles p
    LEFT JOIN (SELECT user_id,COUNT(*) AS post_count,COUNT(*) FILTER(WHERE NOT was_live) AS regular_posts,
                      COUNT(*) FILTER(WHERE was_live) AS live_posts FROM posts GROUP BY user_id) pc ON pc.user_id=p.id
    LEFT JOIN (SELECT po.user_id,COUNT(*) AS like_count FROM post_likes l
               JOIN posts po ON po.id=l.post_id GROUP BY po.user_id) lc ON lc.user_id=p.id
    LEFT JOIN (SELECT user_id,COUNT(*) AS comment_count FROM comments GROUP BY user_id) cc ON cc.user_id=p.id
    WHERE p.role <> 'owner'
  )
  SELECT jsonb_agg(t ORDER BY (t->>'xp')::int DESC), COALESCE(SUM(x.xp),0)
    INTO top_users, total_xp
  FROM (SELECT * FROM xp) x,
       LATERAL (SELECT jsonb_build_object('username',x.username,'role',x.role,
                       'post_count',x.post_count,'xp',x.xp) AS t) j;

  SELECT jsonb_agg(e) INTO top_users FROM (
    SELECT jsonb_build_object('username',username,'role',role,'post_count',post_count,'xp',xp) AS e
    FROM (
      SELECT p.username, p.role, COALESCE(pc.post_count,0) AS post_count,
        (COALESCE(pc.regular_posts,0)*20 + COALESCE(pc.live_posts,0)*50
         + COALESCE(lc.like_count,0)*5 + COALESCE(cc.comment_count,0)*3
         + CASE WHEN p.bio IS NOT NULL AND p.bio!='' THEN 10 ELSE 0 END
         + CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END
         + CASE WHEN p.platform IS NOT NULL THEN 5 ELSE 0 END
         + CASE WHEN p.discord IS NOT NULL AND p.discord!='' THEN 10 ELSE 0 END
         + CASE WHEN p.twitch IS NOT NULL AND p.twitch!='' THEN 10 ELSE 0 END
         + CASE WHEN p.youtube IS NOT NULL AND p.youtube!='' THEN 10 ELSE 0 END) AS xp
      FROM profiles p
      LEFT JOIN (SELECT user_id,COUNT(*) AS post_count,COUNT(*) FILTER(WHERE NOT was_live) AS regular_posts,
                        COUNT(*) FILTER(WHERE was_live) AS live_posts FROM posts GROUP BY user_id) pc ON pc.user_id=p.id
      LEFT JOIN (SELECT po.user_id,COUNT(*) AS like_count FROM post_likes l
                 JOIN posts po ON po.id=l.post_id GROUP BY po.user_id) lc ON lc.user_id=p.id
      LEFT JOIN (SELECT user_id,COUNT(*) AS comment_count FROM comments GROUP BY user_id) cc ON cc.user_id=p.id
      WHERE p.role <> 'owner'
      ORDER BY xp DESC LIMIT 10) ranked) agg;

  SELECT COUNT(DISTINCT uid) INTO active_count FROM (
    SELECT user_id AS uid FROM posts WHERE created_at>=CURRENT_DATE-INTERVAL '7 days'
    UNION SELECT user_id FROM comments WHERE created_at>=CURRENT_DATE-INTERVAL '7 days') acts;

  SELECT COUNT(*) INTO inactive_count FROM profiles p
   WHERE p.created_at<CURRENT_DATE-INTERVAL '30 days' AND p.role!='owner'
     AND NOT EXISTS(SELECT 1 FROM posts WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days')
     AND NOT EXISTS(SELECT 1 FROM comments WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days');

  RETURN jsonb_build_object('top_posts',COALESCE(top_posts,'[]'::jsonb),
    'top_users',COALESCE(top_users,'[]'::jsonb),
    'active_7d',active_count,'inactive_30d',inactive_count,'total_xp',COALESCE(total_xp,0));
END;
$function$;;
