-- CORREÇÃO DE SEGURANÇA + consolidação (multiple_permissive_policies).
-- Bug: INSERT de posts/community_posts tinha 2 políticas permissivas OR'd, o que
-- anulava a regra "banido não posta" (o usuário passava pela outra política).
-- Fix: uma única política com AND (dono E não-banido). Demais merges são OR
-- equivalentes (admin OU dono), só reduzindo nº de políticas avaliadas.

-- posts INSERT (AND)
drop policy "Auth insert posts" on public.posts;
drop policy "Banidos nao postam" on public.posts;
create policy "posts_insert" on public.posts for insert to public
  with check ((select auth.uid()) = user_id
    and not ((select auth.uid()) in (select id from public.profiles where banned = true)));

-- posts DELETE (dono OU admin)
drop policy "Admins deletam posts" on public.posts;
drop policy "User deleta proprio post" on public.posts;
create policy "posts_delete" on public.posts for delete to public
  using ((select auth.uid()) = user_id
    or (select auth.uid()) in (select id from public.profiles where role = any(array['admin','super_admin'])));

-- posts UPDATE (dono OU admin)
drop policy "Admins update posts" on public.posts;
drop policy "User update proprio post" on public.posts;
create policy "posts_update" on public.posts for update to public
  using ((select auth.uid()) = user_id
    or (select auth.uid()) in (select id from public.profiles where role = any(array['admin','super_admin'])));

-- community_posts INSERT (AND)
drop policy "Auth insert community" on public.community_posts;
drop policy "Banidos nao postam no mural" on public.community_posts;
create policy "community_posts_insert" on public.community_posts for insert to public
  with check ((select auth.uid()) = user_id
    and not ((select auth.uid()) in (select id from public.profiles where banned = true)));

-- community_posts DELETE (dono OU admin)
drop policy "Admins deletam msgs" on public.community_posts;
drop policy "User deleta propria msg" on public.community_posts;
create policy "community_posts_delete" on public.community_posts for delete to public
  using ((select auth.uid()) = user_id
    or (select auth.uid()) in (select id from public.profiles where role = any(array['admin','super_admin'])));

-- comments DELETE (dono OU admin)
drop policy "Admins deletam comentarios" on public.comments;
drop policy "User deleta proprio comentario" on public.comments;
create policy "comments_delete" on public.comments for delete to public
  using ((select auth.uid()) = user_id
    or (select auth.uid()) in (select id from public.profiles where role = any(array['admin','super_admin'])));

-- profiles UPDATE (próprio OU admin) — colunas sensíveis seguem protegidas pelo guard
drop policy "Admins podem atualizar profiles" on public.profiles;
drop policy "Usuario atualiza proprio profile" on public.profiles;
create policy "profiles_update" on public.profiles for update to public
  using ((select auth.uid()) = id
    or (select auth.uid()) in (select p.id from public.profiles p where p.role = any(array['admin','super_admin'])));

-- admin_logs SELECT (admin/super_admin/owner numa só)
drop policy "admins_select_logs" on public.admin_logs;
drop policy "owner_select_logs" on public.admin_logs;
drop policy "superadmin_select_logs" on public.admin_logs;
create policy "admin_logs_select" on public.admin_logs for select to public
  using (exists (select 1 from public.profiles where id=(select auth.uid()) and role = any(array['admin','super_admin','owner'])));
;
