-- Trilha de auditoria: dois furos na policy de INSERT de `admin_logs`.
--
-- A policy antiga era:
--   WITH CHECK ( auth.uid() IN (select id from profiles
--                               where role = ANY(ARRAY['admin','super_admin'])) )
--
-- Ela checava APENAS se quem chama é admin. Não checava se as colunas de
-- identidade gravadas na linha (`admin_id`, `actor_id`) pertencem a quem está
-- chamando. Duas consequências, ambas reproduzidas em transação com ROLLBACK
-- antes desta migration:
--
-- 1) FORJA — qualquer admin conseguia inserir uma entrada de auditoria
--    atribuída a OUTRA pessoa, inclusive ao fundador. A trilha existe
--    justamente pra dizer quem fez o quê; forjável, ela não serve.
--
-- 2) FUNDADOR SEM RASTRO — 'owner' não estava na lista de papéis, então o
--    INSERT do fundador era negado pela RLS. Como o cliente (`Admin.jsx`)
--    descartava o erro, a negativa era SILENCIOSA: as ações do usuário mais
--    privilegiado do site (apagar posts, encerrar live, restaurar post) não
--    deixavam registro nenhum.
--
-- A policy nova exige que a linha seja auto-atribuída E que quem chama seja
-- staff, agora incluindo 'owner'.
--
-- Isto NÃO afeta os logs gravados pelo sistema: as 19 funções SECURITY DEFINER
-- que inserem em `admin_logs` rodam como dona da tabela e `admin_logs` não tem
-- FORCE ROW LEVEL SECURITY, então continuam ignorando RLS normalmente.

DROP POLICY IF EXISTS admins_insert_logs ON public.admin_logs;

CREATE POLICY admins_insert_logs ON public.admin_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    -- não dá pra escrever log em nome de outra pessoa
    admin_id = (select auth.uid())
    AND actor_id = (select auth.uid())
    -- e quem escreve precisa ser staff (agora com o fundador incluído)
    AND (select auth.uid()) IN (
      select id from public.profiles
      where role in ('admin', 'super_admin', 'owner')
    )
  );

-- Defesa em profundidade: `anon` tinha o privilégio de INSERT na tabela. A RLS
-- já barrava (anon não tem auth.uid()), mas isso é proteção por efeito
-- colateral — o privilégio nunca deveria estar lá.
REVOKE INSERT ON public.admin_logs FROM anon;;
