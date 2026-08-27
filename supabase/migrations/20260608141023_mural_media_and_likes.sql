create table public.community_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  url text not null,
  type text not null default 'image',
  position int not null default 0,
  created_at timestamptz default now()
);
create index community_post_media_post_id_idx on public.community_post_media(post_id);

create table public.community_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);
create index community_post_likes_post_id_idx on public.community_post_likes(post_id);

alter table public.community_post_media enable row level security;
alter table public.community_post_likes enable row level security;

create policy "cpm_select" on public.community_post_media for select using (true);
create policy "cpm_insert" on public.community_post_media for insert
  with check ((select auth.uid()) in (select user_id from public.community_posts where id = post_id));
create policy "cpm_delete" on public.community_post_media for delete
  using (
    (select auth.uid()) in (select user_id from public.community_posts where id = post_id)
    or (select auth.uid()) in (select id from public.profiles where role = any(array['admin','super_admin']))
  );

create policy "cpl_select" on public.community_post_likes for select using (true);
create policy "cpl_insert" on public.community_post_likes for insert
  with check (
    (select auth.uid()) = user_id
    and not ((select auth.uid()) in (select id from public.profiles where banned = true))
  );
create policy "cpl_delete" on public.community_post_likes for delete
  using ((select auth.uid()) = user_id);;
