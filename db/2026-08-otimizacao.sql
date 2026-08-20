-- ============================================================================
-- GamerHub — Otimização de custo/performance (ago/2026)
-- ============================================================================
--
-- COMO RODAR: cole cada bloco no SQL Editor do Supabase, um de cada vez, e
-- confira o resultado antes de ir pro próximo. Nada aqui apaga dado de
-- conteúdo (post, perfil, comentário) nem muda RLS.
--
-- Contexto: a organização estourou o Cached Egress do plano Free. A parte
-- pesada do conserto foi feita no frontend (compressão de imagem, mídia sob
-- demanda, fim do N+1 no feed). Este arquivo cobre o que só dá pra fazer no
-- banco:
--   BLOCO 1 — índices que faltam nas colunas que a UI filtra/ordena
--   BLOCO 2 — retenção: tabelas de log/efêmeras crescem sem teto hoje
--   BLOCO 3 — correção do ranking "top posts" do painel do fundador
--
-- Todos os blocos são idempotentes: rodar duas vezes não causa efeito extra.
-- ============================================================================


-- ============================================================================
-- BLOCO 1 — Índices faltantes
-- ============================================================================
-- Todos são `IF NOT EXISTS`. Índice novo em tabela pequena é instantâneo; se
-- alguma tabela já estiver grande, troque por CREATE INDEX CONCURRENTLY
-- (que NÃO pode rodar dentro de transação).

-- Feed: ORDER BY created_at DESC LIMIT 30, filtrando deletados/lives.
CREATE INDEX IF NOT EXISTS idx_posts_feed
  ON public.posts (created_at DESC)
  WHERE deleted_at IS NULL AND live_kind IS NULL;

-- Lives ativas: WHERE is_live = true.
CREATE INDEX IF NOT EXISTS idx_posts_is_live
  ON public.posts (created_at DESC)
  WHERE is_live = true;

-- Mural: paginação por keyset em created_at.
CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.community_posts (created_at DESC);

-- Sino do header: notificações do usuário, mais recentes primeiro.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Chat de live: sempre lido por post, em ordem cronológica.
CREATE INDEX IF NOT EXISTS idx_live_chat_post_created
  ON public.live_chat (post_id, created_at);

-- Comentários de um post, em ordem.
CREATE INDEX IF NOT EXISTS idx_comments_post_created
  ON public.comments (post_id, created_at);

-- Curtidas de comentário pelo usuário (o par inverso já é coberto pela UNIQUE).
CREATE INDEX IF NOT EXISTS idx_comment_likes_user
  ON public.comment_likes (user_id);

-- Nota: post_likes(post_id, …) e community_post_likes(post_id) já têm índice
-- (constraint UNIQUE e índice dedicado, respectivamente) — as contagens em
-- lote do feed e do mural já usam índice.


-- ============================================================================
-- BLOCO 2 — Retenção de tabelas de log / efêmeras
-- ============================================================================
-- Problema: `admin_logs`, `login_attempts`, `notifications` e `live_chat`
-- crescem para sempre. Chat de live encerrada há meses continua ocupando
-- espaço, inflando índice e backup.
--
-- 2.1 — DIMENSIONE ANTES DE APAGAR. Rode isto e confira os números:

/*
SELECT 'admin_logs > 90d'        AS alvo, count(*) FROM public.admin_logs    WHERE created_at < now() - interval '90 days'
UNION ALL SELECT 'notifications lidas > 30d', count(*) FROM public.notifications WHERE read = true AND created_at < now() - interval '30 days'
UNION ALL SELECT 'login_attempts limpos > 30d', count(*) FROM public.login_attempts
  WHERE permanent = false AND (blocked_until IS NULL OR blocked_until < now()) AND updated_at < now() - interval '30 days'
UNION ALL SELECT 'live_chat de live encerrada > 7d', count(*) FROM public.live_chat lc
  JOIN public.posts p ON p.id = lc.post_id
  WHERE p.is_live = false AND lc.created_at < now() - interval '7 days';
*/

-- 2.2 — A função de limpeza. Só cria a função; não apaga nada sozinha.
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_logs    bigint;
  v_notifs  bigint;
  v_logins  bigint;
  v_chat    bigint;
BEGIN
  -- Auditoria administrativa: 90 dias é bem mais do que qualquer investigação
  -- retroativa que o painel permite consultar.
  DELETE FROM admin_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  -- Notificação já lida e velha não é mostrada em lugar nenhum.
  DELETE FROM notifications
   WHERE read = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_notifs = ROW_COUNT;

  -- Tentativas de login que não estão mais bloqueando ninguém. Bloqueio
  -- PERMANENTE nunca é apagado (é decisão de moderação, não lixo).
  DELETE FROM login_attempts
   WHERE permanent = false
     AND (blocked_until IS NULL OR blocked_until < now())
     AND updated_at < now() - interval '30 days';
  GET DIAGNOSTICS v_logins = ROW_COUNT;

  -- Chat de live já encerrada. A live em andamento nunca é tocada.
  DELETE FROM live_chat lc
   USING posts p
   WHERE p.id = lc.post_id
     AND p.is_live = false
     AND lc.created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_chat = ROW_COUNT;

  RETURN jsonb_build_object(
    'admin_logs', v_logs,
    'notifications', v_notifs,
    'login_attempts', v_logins,
    'live_chat', v_chat
  );
END;
$function$;

-- Só o banco (pg_cron / SQL Editor) chama isto — nunca o cliente.
REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC, anon, authenticated;

-- 2.3 — Primeira execução MANUAL, depois de conferir os números do 2.1:
--   SELECT public.cleanup_old_data();

-- 2.4 — Agendamento diário às 4h UTC (opcional). Se o pg_cron não estiver
-- disponível no projeto, ignore este bloco e rode a função na mão de vez em
-- quando — o resultado é o mesmo.
/*
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('gamerhub-cleanup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'gamerhub-cleanup');
SELECT cron.schedule('gamerhub-cleanup', '0 4 * * *', $$SELECT public.cleanup_old_data();$$);
*/


-- ============================================================================
-- BLOCO 3 — "Top posts" do painel do fundador
-- ============================================================================
-- Bug: o ranking ordenava por `posts.likes`, uma coluna desnormalizada que
-- NENHUM trigger mantém — está 0 em toda linha, então o "top 10" saía numa
-- ordem arbitrária. Aqui ele passa a contar de `post_likes`, a fonte de
-- verdade real (mesma correção já feita no frontend em fetchProfileStats).
--
-- O resto da função continua idêntico — só o bloco `top_posts` mudou.
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
$function$;


-- ============================================================================
-- NÃO ENTRA AQUI (de propósito)
-- ============================================================================
-- • Trigger para manter `posts.likes`: seria o jeito "clássico" de matar a
--   contagem por post, MAS `posts` tem triggers em AFTER UPDATE
--   (`on_post_event`, `trg_notify_new_live`) e cada curtida passaria a
--   disparar essa cadeia. O frontend já resolveu o problema contando em lote
--   (1 query por feed), então o risco não se paga. A coluna `posts.likes`
--   segue morta e NÃO é lida por lugar nenhum do app.
-- • Mexer na publicação `supabase_realtime` (tirar post_media/admin_logs) e no
--   REPLICA IDENTITY de `profiles`: mudanças com efeito colateral sutil em
--   detecção de ban e sincronização de mídia. Ficam pro backlog, com janela
--   de teste dedicada.
