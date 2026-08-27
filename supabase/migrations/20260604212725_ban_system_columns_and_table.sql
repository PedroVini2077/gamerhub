-- Colunas de ban na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_details text,
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS banned_by_username text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

-- Tabela de solicitações de desbanimento (admin → super_admin)
CREATE TABLE IF NOT EXISTS public.unban_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_username text NOT NULL,
  requesting_admin_id uuid NOT NULL,
  requesting_admin_username text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at timestamptz DEFAULT now(),
  reviewed_by uuid,
  reviewed_by_username text,
  reviewed_at timestamptz,
  review_note text
);

ALTER TABLE public.unban_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unban_req_select ON public.unban_requests;
DROP POLICY IF EXISTS unban_req_insert ON public.unban_requests;
DROP POLICY IF EXISTS unban_req_update ON public.unban_requests;

CREATE POLICY unban_req_select ON public.unban_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY unban_req_insert ON public.unban_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY unban_req_update ON public.unban_requests FOR UPDATE TO authenticated USING (true);;
