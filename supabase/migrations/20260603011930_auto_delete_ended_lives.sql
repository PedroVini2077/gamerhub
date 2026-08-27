ALTER TABLE posts ADD COLUMN IF NOT EXISTS live_ended_at timestamptz;

-- Backfill: posts já encerrados ganham live_ended_at = now() para serem limpos em breve
UPDATE posts SET live_ended_at = now()
WHERE was_live = true AND is_live = false AND live_ended_at IS NULL;

CREATE OR REPLACE FUNCTION set_live_ended_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_live = false AND OLD.is_live = true THEN
    NEW.live_ended_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_live_ended_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_live_ended_at();

SELECT cron.unschedule('expire-lives');

SELECT cron.schedule(
  'expire-lives',
  '*/5 * * * *',
  $$
    UPDATE public.posts SET is_live = false
    WHERE is_live = true AND (
      (expires_at IS NOT NULL AND expires_at < now())
      OR created_at < now() - interval '24 hours'
    );

    DELETE FROM public.posts
    WHERE was_live = true
      AND is_live = false
      AND live_ended_at IS NOT NULL
      AND live_ended_at < now() - interval '15 minutes';
  $$
);
;
