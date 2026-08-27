create policy "Dono e admin deletam mensagens" on live_chat
  for delete using (
    auth.uid() = user_id or
    auth.uid() in (
      select id from profiles where role in ('admin', 'super_admin')
    ) or
    auth.uid() in (
      select user_id from posts where id = post_id
    )
  );

create table if not exists live_chat_timeouts (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table live_chat_timeouts enable row level security;

create policy "Todos veem timeouts" on live_chat_timeouts for select using (true);

create policy "Admin e dono criam timeout" on live_chat_timeouts for insert with check (
  auth.uid() in (select id from profiles where role in ('admin', 'super_admin')) or
  auth.uid() in (select user_id from posts where id = post_id)
);

create policy "Admin e dono deletam timeout" on live_chat_timeouts for delete using (
  auth.uid() in (select id from profiles where role in ('admin', 'super_admin')) or
  auth.uid() in (select user_id from posts where id = post_id)
);
;
