-- SEC-053b — CORREÇÃO DA MINHA PRÓPRIA MIGRATION, minutos depois.
--
-- Na `sec_053_auditor_passa_a_olhar_policies` eu troquei o literal
-- `role = 'owner'` por `is_owner()` nas três policies de `site_config`,
-- justificando que "é a MESMA condição".
--
-- ISSO CONTRADIZ UMA DECISÃO JÁ ESCRITA. O `SEGURANCA.md`, na SEC-051 (24/09),
-- registra exatamente esta troca como **não mecânica** e como decisão do dono:
--
--   "`is_owner()` é `role_rank(...) >= 4`; o literal é `= 'owner'`. Hoje dão o
--    mesmo resultado, mas um cargo futuro de rank 5 passaria num e não no
--    outro. É decisão de semântica — §7 🟡."
--
-- O argumento continua valendo, e o fato de eu ter escrito o oposto hoje não o
-- derruba. Fazer em silêncio o que um documento meu classificou como decisão
-- dele é pior do que não fazer: envelhece o documento por dentro.
--
-- Então as três voltam ao literal, e entram na lista de exceção da 6ª checagem
-- COM O MOTIVO — o mesmo tratamento que a SEC-051 deu às cinco funções do
-- painel do fundador. A troca (funções e policies juntas) está proposta no
-- `BACKLOG.md` como uma decisão só.
--
-- O que NÃO muda: nenhuma das três é brecha. `operador_ativo()` é sempre true
-- para o `owner`, então o estado do operador não estava sendo perdido aqui —
-- ao contrário das 23 policies da SEC-053, onde estava.

ALTER POLICY site_config_owner_delete ON site_config
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));
ALTER POLICY site_config_owner_insert ON site_config
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));
ALTER POLICY site_config_owner_update ON site_config
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));

-- A 6ª checagem ganha a lista de exceção, com o porquê ao lado — e a trava
-- `auditorDoBancoEhOuvido.test.js` já reprova se uma lista dessas crescer em
-- silêncio.
CREATE OR REPLACE FUNCTION public.auditoria_de_operadores()
 RETURNS TABLE(funcao text, problema text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT p.oid, p.proname::text AS nome,
           -- PROSA NAO E CODIGO: sem isto, um comentario citando
           -- `exige_operador_ativo` faria a funcao parecer guardada.
           regexp_replace(regexp_replace(pg_get_functiondef(p.oid),'--[^\n]*',' ','g'),
                          '/\*.*?\*/',' ','gs') AS def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
  SELECT nome, 'administrativa e NAO chama exige_operador_ativo() (SEC-043)'
    FROM f
   WHERE def ~* 'role_rank|is_staff\(|is_super\(|is_owner\('
     AND def !~* 'exige_operador_ativo'
     AND nome NOT IN (
       'is_staff','is_super','is_owner','role_rank','can_moderate_content',
       'operador_ativo','exige_operador_ativo','exige_alvo_apto',
       'check_staff_eligibility','log_audit_event','confere_a_propria_senha',
       'pode_publicar','post_aceita_interacao')
  UNION ALL
  -- SEC-051: o ponto cego. Autorizar por literal nao casa com a heuristica de
  -- cima, entao a funcao ficava invisivel para as outras tres checagens.
  SELECT nome, 'autoriza por LITERAL de papel, sem funcao de hierarquia (SEC-051)'
    FROM f
   WHERE (def ~* 'role\s*=\s*''(owner|super_admin|admin)'''
       OR def ~* 'role\s+IN\s*\(\s*''(owner|super_admin|admin)''')
     AND def !~* 'role_rank|is_staff\(|is_super\(|is_owner\('
     AND nome NOT IN (
       'operador_ativo',
       'owner_get_stats','owner_get_users','owner_get_metrics',
       'owner_get_audit_logs','owner_get_notifications')
  UNION ALL
  SELECT p.proname::text, 'funcao de TRIGGER chamavel como RPC (SEC-042)'
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prorettype='trigger'::regtype
     AND (has_function_privilege('anon', p.oid,'EXECUTE')
       OR has_function_privilege('authenticated', p.oid,'EXECUTE'))
  UNION ALL
  SELECT p.proname::text, 'alcancavel por ANON — confira se e intencional'
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND has_function_privilege('anon', p.oid,'EXECUTE')
     AND p.proname NOT IN ('contagem_de_migrations','username_disponivel','role_rank',
                           'contagem_de_achados_de_seguranca')
  UNION ALL
  -- SEC-052: tabela com GRANT e ZERO policies. Hoje nao entrega linha nenhuma
  -- — a RLS sem policy nega tudo —, e e justamente por isso que passa batido:
  -- a protecao e ACIDENTAL. Basta alguem escrever a primeira policy para o
  -- grant, que ja estava la, passar a valer.
  SELECT t.tablename::text,
         'tabela com GRANT para anon/authenticated e ZERO policies (SEC-052)'
    FROM pg_tables t
   WHERE t.schemaname='public'
     AND NOT EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname='public' AND p.tablename=t.tablename)
     AND EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                  WHERE g.table_schema='public' AND g.table_name=t.tablename
                    AND g.grantee IN ('anon','authenticated'))
  UNION ALL
  -- SEC-053: POLICY com a hierarquia escrita a mao.
  --
  -- `is_staff()`/`is_super()` embutem `operador_ativo()`; `role_rank(...) >= 2`
  -- escrito na policy reimplementa METADE da regra e perde a pergunta "quem
  -- chama ainda esta apto?". Medido: um admin BANIDO lia a fila inteira, a
  -- trilha de 4.102 linhas e ESCREVIA na wordlist.
  --
  -- AS TRES EXCECOES sao as policies de `site_config` do fundador. Elas usam
  -- `role = 'owner'` literal, e trocar por `is_owner()` e decisao de SEMANTICA,
  -- nao limpeza: `is_owner()` e `role_rank >= 4`, entao um cargo futuro de rank
  -- 5 passaria num e nao no outro. A SEC-051 ja registrou isso como decisao do
  -- dono para as cinco funcoes do painel dele; estas tres entram na MESMA
  -- decisao, proposta no BACKLOG.
  --
  -- Nao sao brecha: `operador_ativo()` e sempre true para o owner, entao aqui
  -- nao se perde estado de operador nenhum.
  SELECT (t.tablename||'.'||t.policyname)::text,
         'POLICY com hierarquia a mao — use is_staff()/is_super()/is_owner() (SEC-053)'
    FROM pg_policies t
   WHERE t.schemaname='public'
     AND (coalesce(t.qual,'')||coalesce(t.with_check,''))
           ~* 'role_rank|role\s*=\s*''(owner|super_admin|admin)''|role\s*=\s*ANY'
     AND (coalesce(t.qual,'')||coalesce(t.with_check,''))
           !~* 'is_staff\(|is_super\(|is_owner\('
     AND t.policyname NOT IN (
       'site_config_owner_delete','site_config_owner_insert','site_config_owner_update')
  ORDER BY 1;
$function$;
