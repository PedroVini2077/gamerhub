-- Permite que super_admins leiam login_rate_limits via RLS (necessário para realtime)
CREATE POLICY super_admin_read ON public.login_rate_limits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Garante que realtime esteja habilitado para a tabela
ALTER TABLE public.login_rate_limits REPLICA IDENTITY FULL;
;
