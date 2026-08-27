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
  ON public.comment_likes (user_id);;
