-- Habilitar pg_cron e pg_net se não estiverem ativos
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Job: a cada 5 minutos, seta is_live=false em posts expirados
select cron.schedule(
  'expire-lives',
  '*/5 * * * *',
  $$
    update public.posts
    set is_live = false
    where is_live = true
      and expires_at is not null
      and expires_at < now();
  $$
);
;
