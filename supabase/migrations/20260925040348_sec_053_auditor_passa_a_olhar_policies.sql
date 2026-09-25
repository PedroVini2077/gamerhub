-- SEC-053, a trava. O auditor tinha CINCO checagens e as cinco olhavam FUNÇÃO
-- ou TABELA. Nenhuma olhava POLICY — e foi exatamente por isso que 23 policies
-- com a hierarquia escrita à mão conviveram com um auditor "sem achados".
--
-- Auditor que não olha uma superfície inteira não fica só incompleto: ele
-- IMPRIME ZERO sobre ela, que é pior — ensina a confiar num sinal que não
-- sustenta nada (§0.2, 4ª regra).

-- 1. As três últimas policies com papel literal viram `is_owner()`.
--    `is_owner()` é `role_rank(...) >= 4`, e `role_rank` mapeia owner -> 4:
--    é a MESMA condição, escrita pela função em vez de à mão. Isso é o que
--    permite a checagem abaixo nascer SEM lista de exceção — e lista de
--    exceção é o que apodrece e volta a esconder achado.
ALTER POLICY site_config_owner_delete ON site_config USING (is_owner());
ALTER POLICY site_config_owner_insert ON site_config WITH CHECK (is_owner());
ALTER POLICY site_config_owner_update ON site_config USING (is_owner()) WITH CHECK (is_owner());

-- 2. A 6ª checagem.
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
  --
  -- Toda tabela nova nasce assim: medido em `pg_default_acl`, `postgres` da
  -- `arwdm` a `authenticated` sem ninguem pedir.
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
  -- Sem lista de excecao de proposito: hoje NENHUMA policy precisa escrever
  -- papel a mao, e manter assim e o que impede a lista de virar esconderijo.
  SELECT (t.tablename||'.'||t.policyname)::text,
         'POLICY com hierarquia a mao — use is_staff()/is_super()/is_owner() (SEC-053)'
    FROM pg_policies t
   WHERE t.schemaname='public'
     AND (coalesce(t.qual,'')||coalesce(t.with_check,''))
           ~* 'role_rank|role\s*=\s*''(owner|super_admin|admin)''|role\s*=\s*ANY'
     AND (coalesce(t.qual,'')||coalesce(t.with_check,''))
           !~* 'is_staff\(|is_super\(|is_owner\('
  ORDER BY 1;
$function$;
