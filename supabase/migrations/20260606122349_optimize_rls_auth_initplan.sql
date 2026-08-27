-- Otimização auth_rls_initplan: envolve auth.uid() em (select auth.uid())
-- para o Postgres avaliar uma vez por query, não por linha. Mesma semântica.

-- profiles
alter policy "Usuario insere proprio profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "Usuario atualiza proprio profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "Admins podem atualizar profiles" on public.profiles
  using ((select auth.uid()) in (select profiles_1.id from profiles profiles_1 where profiles_1.role = any (array['admin','super_admin'])));

-- posts
alter policy "Admins deletam posts" on public.posts
  using ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "User deleta proprio post" on public.posts
  using ((select auth.uid()) = user_id);
alter policy "Auth insert posts" on public.posts
  with check ((select auth.uid()) = user_id);
alter policy "Banidos nao postam" on public.posts
  with check (not ((select auth.uid()) in (select profiles.id from profiles where profiles.banned = true)));
alter policy "Admins update posts" on public.posts
  using ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "User update proprio post" on public.posts
  using ((select auth.uid()) = user_id);

-- comments
alter policy "Admins deletam comentarios" on public.comments
  using ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "User deleta proprio comentario" on public.comments
  using ((select auth.uid()) = user_id);
alter policy "Auth insere comentario" on public.comments
  with check (((select auth.uid()) = user_id) and (not ((select auth.uid()) in (select profiles.id from profiles where profiles.banned = true))));

-- community_posts
alter policy "Admins deletam msgs" on public.community_posts
  using ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "User deleta propria msg" on public.community_posts
  using ((select auth.uid()) = user_id);
alter policy "Auth insert community" on public.community_posts
  with check ((select auth.uid()) = user_id);
alter policy "Banidos nao postam no mural" on public.community_posts
  with check (not ((select auth.uid()) in (select profiles.id from profiles where profiles.banned = true)));

-- game_keys
alter policy "Admins atualizam keys" on public.game_keys
  using ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
  with check ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "Admins deletam keys" on public.game_keys
  using ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "Admins inserem keys" on public.game_keys
  with check ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));

-- post_likes
alter policy "User remove proprio like" on public.post_likes
  using ((select auth.uid()) = user_id);
alter policy "User insere proprio like" on public.post_likes
  with check ((select auth.uid()) = user_id);

-- post_media
alter policy "Auth deleta propria midia" on public.post_media
  using ((select auth.uid()) in (select posts.user_id from posts where posts.id = post_media.post_id));
alter policy "Auth insere midia" on public.post_media
  with check ((select auth.uid()) is not null);

-- notifications
alter policy "User ve proprias notificacoes" on public.notifications
  using ((select auth.uid()) = user_id);
alter policy "User marca como lida" on public.notifications
  using ((select auth.uid()) = user_id);

-- live_chat
alter policy "Dono e admin deletam mensagens" on public.live_chat
  using (((select auth.uid()) = user_id)
    or ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_chat.post_id)));
alter policy "Auth envia mensagem" on public.live_chat
  with check ((select auth.uid()) = user_id);

-- live_chat_timeouts
alter policy "Admin e dono deletam timeout" on public.live_chat_timeouts
  using (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_chat_timeouts.post_id)));
alter policy "Admin e dono criam timeout" on public.live_chat_timeouts
  with check (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_chat_timeouts.post_id)));
alter policy "Admin e dono atualizam timeout" on public.live_chat_timeouts
  using (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_chat_timeouts.post_id)))
  with check (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_chat_timeouts.post_id)));

-- live_muted
alter policy "Admin e dono removem silencio" on public.live_muted
  using (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_muted.post_id)));
alter policy "Admin e dono silenciam" on public.live_muted
  with check (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])))
    or ((select auth.uid()) in (select posts.user_id from posts where posts.id = live_muted.post_id)));

-- live_reactivation_requests
alter policy "admins_insert_requests" on public.live_reactivation_requests
  with check (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','super_admin']) and (not profiles.banned)));
alter policy "select_own_or_superadmin_requests" on public.live_reactivation_requests
  using ((admin_id = (select auth.uid())) or (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'super_admin')));
alter policy "superadmin_update_requests" on public.live_reactivation_requests
  using (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'super_admin'));

-- admin_logs
alter policy "admins_insert_logs" on public.admin_logs
  with check ((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin'])));
alter policy "admins_select_logs" on public.admin_logs
  using (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','super_admin'])));
alter policy "owner_select_logs" on public.admin_logs
  using (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'owner'));
alter policy "superadmin_select_logs" on public.admin_logs
  using (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'super_admin'));

-- admin_notification_reads
alter policy "admins_insert_reads" on public.admin_notification_reads
  with check (((select auth.uid()) in (select profiles.id from profiles where profiles.role = any (array['admin','super_admin']))) and (admin_id = (select auth.uid())));
alter policy "admins_select_reads" on public.admin_notification_reads
  using (admin_id = (select auth.uid()));

-- admin_notifications
alter policy "admins_select_notifications" on public.admin_notifications
  using (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','super_admin'])));

-- site_config
alter policy "site_config_owner_all" on public.site_config
  using (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'owner'))
  with check (exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.role = 'owner'));
;
