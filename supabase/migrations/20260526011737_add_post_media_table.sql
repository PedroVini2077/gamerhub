create table post_media (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image', 'video', 'audio')),
  position int default 0,
  created_at timestamptz default now()
);

alter table post_media enable row level security;

create policy "Todos veem midias" on post_media for select using (true);
create policy "Auth insere midia" on post_media for insert with check (auth.uid() is not null);
create policy "Auth deleta propria midia" on post_media for delete using (
  auth.uid() in (select user_id from posts where id = post_id)
);

alter publication supabase_realtime add table post_media;
;
