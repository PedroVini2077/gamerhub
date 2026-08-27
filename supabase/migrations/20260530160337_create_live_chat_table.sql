create table if not exists live_chat (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

alter table live_chat enable row level security;

create policy "Todos veem chat" on live_chat for select using (true);
create policy "Auth envia mensagem" on live_chat for insert with check (auth.uid() = user_id);

alter publication supabase_realtime add table live_chat;
;
