-- SEC-028 · `[18/09]` O XP passa a contar so o que EXISTE, e as TRES formulas
-- viram UMA. Fecha 5 achados do pentest (XP-001, XP-002, XP-LIVE-003, 7, 12).
--
-- ── Achado 12: eram TRES formulas, e a divergencia e mais estreita do que o
--    relatorio diz ──────────────────────────────────────────────────────────
--
-- `get_user_xp`, `owner_get_users` e `owner_get_metrics` calculavam XP cada uma
-- por conta. Conferido linha a linha: post/like/comentario/live **concordam**
-- (20/50/5/3 — o `+30 extra` da primeira da no mesmo que o `*50` das outras).
-- O que divergia era o **bonus de perfil**: 140 contra 60.
--
-- Vale a escala de `get_user_xp` porque e a que a PESSOA ve, no perfil e no
-- Ranks. Adotar a do owner mudaria o numero de todo mundo para fechar uma
-- divergencia interna — o rabo abanando o cachorro.
--
-- ── XP-001 / XP-002 / XP-LIVE-003 / 7: contava o que nao existe ───────────
--
-- As tres somavam `posts` e `comments` **sem filtrar `deleted_at` nem
-- `hidden_at`**. Consequencias medidas pelo pentest:
--   . apagar o proprio post NAO devolvia os 20 XP
--   . comentar e apagar mantinha os 3 XP
--   . comentario OCULTADO PELA MODERACAO continuava pagando
--   . a live apagada continuava pagando os 30
--
-- O ultimo e o pior: **ocultar conteudo era punicao sem efeito**. A moderacao
-- tirava o conteudo da tela e o autor ficava com o XP — inclusive o XP que o
-- levaria a `check_staff_eligibility` (>= 1000 XP para virar admin).
--
-- ── Uma quarta brecha, que o pentest nao viu ──────────────────────────────
--
-- O bonus de perfil testava `IS NOT NULL` e nada mais. `discord`, `twitch`,
-- `youtube` e `avatar_url` aceitam **string vazia** — escrever `''` em quatro
-- campos comprava XP sem preencher nada. Medido em ROLLBACK com papel
-- `authenticated` real: bonus **95 -> 140**, o teto, com quatro strings vazias.
-- (`platform` ja estava protegida pelo CHECK `check_platform`.)
--
-- Agora e `length(trim(x)) > 0` nos seis campos: espaco em branco tambem nao
-- conta, porque " " nao e um perfil preenchido.
--
-- ── A fonte unica, e por que VIEW e nao funcao por usuario ────────────────
--
-- `xp_dos_usuarios` calcula para todo mundo de uma vez, com JOINs agregados. Os
-- paineis do owner listam CENTENAS de perfis: chamar `get_user_xp` por linha
-- seria um N+1 dentro do SQL (§6.1). A view resolve em uma varredura.
--
-- Ela NAO recebe grant nenhum — nem `anon`, nem `authenticated`. Quem le sao as
-- tres funcoes `SECURITY DEFINER`, e a regua de papeis do BANCO.md continua
-- valendo: o publico alcanca FUNCAO, nunca tabela ou view.
--
-- ── O impacto, dito antes de alguem notar (§1.1) ──────────────────────────
--
-- O XP CAI para quem tinha conteudo apagado ou oculto. Medido em ROLLBACK,
-- antes -> depois, nas 5 contas reais do banco:
--
--   claudetester   3575 -> 255   (166 posts contados, TODOS soft-deletados)
--   claudestaff    3120 ->   0   (156 posts contados, idem)
--   ogamerpedro     214 -> 104   (os 4 posts do proprio pentest, apagados)
--   opedrovini       65 ->  65   (inalterado — so bonus de perfil)
--   ovinipedro        0 ->   0
--
-- As duas primeiras sao as contas de teste do e2e, que criam e apagam post a
-- cada rodada de CI. Elas vinham acumulando XP de conteudo que nao existe —
-- o numero novo e o verdadeiro, nao uma perda.

CREATE OR REPLACE VIEW public.xp_dos_usuarios AS
SELECT p.id AS user_id,
  COALESCE(pc.posts,0)::int        AS posts,
  COALESCE(pc.lives,0)::int        AS lives,
  COALESCE(lc.likes,0)::int        AS likes,
  COALESCE(cc.comentarios,0)::int  AS comentarios,
  (CASE WHEN length(trim(COALESCE(p.bio,'')))        > 0 THEN 50 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.avatar_url,''))) > 0 THEN 30 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.platform,'')))   > 0 THEN 15 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.discord,'')))    > 0 THEN 15 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.twitch,'')))     > 0 THEN 15 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.youtube,'')))    > 0 THEN 15 ELSE 0 END)::int AS profile_bonus
FROM profiles p
-- Conteudo apagado ou oculto NAO conta. E o coracao desta migration.
LEFT JOIN (SELECT user_id, COUNT(*) AS posts, COUNT(*) FILTER (WHERE was_live) AS lives
             FROM posts WHERE deleted_at IS NULL AND hidden_at IS NULL
            GROUP BY user_id) pc ON pc.user_id = p.id
-- Curtida em post morto tambem nao conta; e `l.user_id <> po.user_id` mantem a
-- regra que ja existia: curtir o proprio post nunca valeu XP.
LEFT JOIN (SELECT po.user_id, COUNT(*) AS likes
             FROM post_likes l JOIN posts po ON po.id = l.post_id
            WHERE po.deleted_at IS NULL AND po.hidden_at IS NULL
              AND l.user_id <> po.user_id
            GROUP BY po.user_id) lc ON lc.user_id = p.id
LEFT JOIN (SELECT user_id, COUNT(*) AS comentarios
             FROM comments WHERE hidden_at IS NULL
            GROUP BY user_id) cc ON cc.user_id = p.id;

COMMENT ON VIEW public.xp_dos_usuarios IS
  'SEC-028: fonte unica do XP. Nao dar GRANT a anon/authenticated — quem le sao as RPCs SECURITY DEFINER.';

REVOKE ALL ON public.xp_dos_usuarios FROM PUBLIC;
REVOKE ALL ON public.xp_dos_usuarios FROM anon, authenticated;

-- ── 1. A funcao que a PESSOA ve ──────────────────────────────────────────
--
-- ATENCAO ao ler isto de forma isolada: esta versao tem uma regressao que a
-- SEC-028b conserta no minuto seguinte. Ela ficou aqui, e nao foi reescrita por
-- cima, porque o historico e o que explica POR QUE o `COALESCE` de la existe.
CREATE OR REPLACE FUNCTION public.get_user_xp(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT jsonb_build_object(
    'xp',            v.posts*20 + v.lives*30 + v.likes*5 + v.comentarios*3 + v.profile_bonus,
    'posts',         v.posts,
    'likes',         v.likes,
    'comments',      v.comentarios,
    'lives',         v.lives,
    'profile_bonus', v.profile_bonus)
  FROM xp_dos_usuarios v WHERE v.user_id = p_user_id;
$fn$;

-- ── 2. A lista do owner ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_users()
RETURNS TABLE(id uuid, username text, email text, role text, banned boolean,
  ban_count integer, ban_reason text, ban_details text, banned_by_username text,
  banned_at timestamp with time zone, created_at timestamp with time zone,
  post_count bigint, comment_count bigint, xp bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username::TEXT, COALESCE(u.email,'')::TEXT, p.role::TEXT,
    COALESCE(p.banned,false), COALESCE(p.ban_count,0), p.ban_reason::TEXT,
    p.ban_details::TEXT, p.banned_by_username::TEXT, p.banned_at, p.created_at,
    v.posts::BIGINT, v.comentarios::BIGINT,
    (v.posts*20 + v.lives*30 + v.likes*5 + v.comentarios*3 + v.profile_bonus)::BIGINT
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  JOIN xp_dos_usuarios v ON v.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$fn$;

-- ── 3. As metricas do owner ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE top_posts JSONB; top_users JSONB; active_count BIGINT; inactive_count BIGINT; total_xp BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT jsonb_agg(t) INTO top_posts FROM (
    SELECT jsonb_build_object('id',po.id,'title',po.title,'likes',COALESCE(l.cnt,0),
             'username',pr.username,'created_at',po.created_at) AS t
    FROM posts po JOIN profiles pr ON pr.id = po.user_id
    LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id) l ON l.post_id = po.id
    WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days' AND po.deleted_at IS NULL
    ORDER BY COALESCE(l.cnt,0) DESC, po.created_at DESC LIMIT 10) sub;

  SELECT COALESCE(SUM(v.posts*20 + v.lives*30 + v.likes*5 + v.comentarios*3 + v.profile_bonus),0)
    INTO total_xp
    FROM xp_dos_usuarios v JOIN profiles p ON p.id = v.user_id WHERE p.role <> 'owner';

  SELECT jsonb_agg(e ORDER BY ord) INTO top_users FROM (
    SELECT jsonb_build_object('username',p.username,'role',p.role,'post_count',v.posts,
             'xp', v.posts*20 + v.lives*30 + v.likes*5 + v.comentarios*3 + v.profile_bonus) AS e,
           row_number() OVER (ORDER BY (v.posts*20 + v.lives*30 + v.likes*5 + v.comentarios*3 + v.profile_bonus) DESC) AS ord
    FROM xp_dos_usuarios v JOIN profiles p ON p.id = v.user_id
    WHERE p.role <> 'owner'
    ORDER BY ord LIMIT 10) ranked;

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
$fn$;
