select cron.schedule(
  'cleanup-expired-posts',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://yuqbdcoljlvncxdnesxk.supabase.co/functions/v1/cleanup-expired-posts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
;
