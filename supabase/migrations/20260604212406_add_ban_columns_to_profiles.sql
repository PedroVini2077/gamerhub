ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_details text,
  ADD COLUMN IF NOT EXISTS banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS banned_by_username text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;
;
