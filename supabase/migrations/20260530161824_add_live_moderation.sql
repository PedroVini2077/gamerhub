create table if not exists live_muted (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  muted_until timestamptz not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table live_muted enable row level security;
create policy "Todos veem silenciados" on live_muted for select using (true);
create policy "Auth pode silenciar" on live_muted for insert with check (auth.uid() is not null);
create policy "Auth pode remover silencio" on live_muted for delete using (auth.uid() is not null);

create policy "Auth deleta mensagem do chat" on live_chat for delete using (auth.uid() is not null);
;
