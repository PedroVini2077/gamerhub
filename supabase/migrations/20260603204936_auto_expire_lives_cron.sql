SELECT cron.schedule(
  'expire-lives-every-minute',
  '* * * * *',
  $$UPDATE public.posts SET is_live = false WHERE is_live = true AND expires_at IS NOT NULL AND expires_at < NOW()$$
);;
