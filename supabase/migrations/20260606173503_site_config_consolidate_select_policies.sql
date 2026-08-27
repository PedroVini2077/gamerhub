-- site_config tinha 2 policies permissivas cobrindo SELECT (owner_all era ALL + select_all).
-- Substitui a policy ALL do owner por policies de escrita (INSERT/UPDATE/DELETE),
-- deixando o SELECT a cargo apenas de site_config_select_all. Sem mudança de comportamento:
-- escritas continuam via RPC owner_set_site_config (SECURITY DEFINER) e leitura pública mantida.
DROP POLICY site_config_owner_all ON public.site_config;

CREATE POLICY site_config_owner_insert ON public.site_config FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));

CREATE POLICY site_config_owner_update ON public.site_config FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));

CREATE POLICY site_config_owner_delete ON public.site_config FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));;
