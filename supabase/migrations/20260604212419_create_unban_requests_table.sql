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

-- INSERT: usuários autenticados (admins enviam solicitações)
CREATE POLICY "authenticated_insert_unban_requests"
  ON public.unban_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: usuários autenticados
CREATE POLICY "authenticated_select_unban_requests"
  ON public.unban_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: usuários autenticados (super admins aprovam/negam)
CREATE POLICY "authenticated_update_unban_requests"
  ON public.unban_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
;
