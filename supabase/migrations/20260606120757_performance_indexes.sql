-- Índices nas foreign keys sem cobertura (evita seq scans conforme crescer)
create index if not exists idx_comments_post_id            on public.comments(post_id);
create index if not exists idx_comments_user_id            on public.comments(user_id);
create index if not exists idx_community_posts_user_id     on public.community_posts(user_id);
create index if not exists idx_live_chat_post_id           on public.live_chat(post_id);
create index if not exists idx_live_chat_user_id           on public.live_chat(user_id);
create index if not exists idx_live_chat_timeouts_created_by on public.live_chat_timeouts(created_by);
create index if not exists idx_live_chat_timeouts_user_id  on public.live_chat_timeouts(user_id);
create index if not exists idx_live_muted_user_id          on public.live_muted(user_id);
create index if not exists idx_live_reactivation_post_id   on public.live_reactivation_requests(post_id);
create index if not exists idx_notifications_user_id       on public.notifications(user_id);
create index if not exists idx_post_likes_user_id          on public.post_likes(user_id);
create index if not exists idx_post_media_post_id          on public.post_media(post_id);
create index if not exists idx_posts_user_id               on public.posts(user_id);
create index if not exists idx_profiles_banned_by          on public.profiles(banned_by);
create index if not exists idx_site_config_updated_by      on public.site_config(updated_by);
create index if not exists idx_unban_requests_target_user  on public.unban_requests(target_user_id);

-- Remove índice que nunca foi usado
drop index if exists public.idx_admin_logs_severity;
;
