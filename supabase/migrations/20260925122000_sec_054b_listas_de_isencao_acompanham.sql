-- SEC-054b — as três listas de isenção do auditor, depois da troca.
--
-- A SEC-054 trocou o literal por `is_owner()` nas oito, e o auditor **gritou na
-- hora**: 5 achados. Isso é o mecanismo funcionando, não um efeito colateral —
-- as cinco funções do painel mudaram de checagem, não de risco:
--
--   antes:  autorizam por LITERAL, sem função de hierarquia .. (SEC-051)
--   agora:  administrativa e NAO chama exige_operador_ativo() . (SEC-043)
--
-- O motivo da isenção é o MESMO de sempre e continua escrito: guardar o painel
-- do Fundador com `exige_operador_ativo()` arriscaria trancá-lo fora dele **sem
-- inversa**, e ninguém consegue banir o fundador pelo produto de qualquer jeito.
-- Ele decidiu em 25/09 que a troca era só do literal, não da guarda.
--
-- As três mudanças, todas de lista:
--
--   SEC-043  GANHA as cinco `owner_get_*`   (passaram a casar com a heurística)
--   SEC-051  PERDE as cinco                 (não autorizam mais por literal)
--   SEC-053  PERDE as três de `site_config` (não escrevem mais papel à mão)
--
-- Depois disto o auditor volta a 0, e as duas listas que encolheram encolhem
-- **porque o problema sumiu**, não porque alguém as esvaziou. A trava
-- `auditorDoBancoEhOuvido.test.js` exige que os mapas dela batam com estas
-- listas — e desde hoje ela vigia também a do SEC-043, que era a MAIOR e a
-- única sem vigia.

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
       'pode_publicar','post_aceita_interacao',
       -- SEC-054: o painel do Fundador. Guarda de operador aqui arriscaria
       -- lockout sem inversa, e ninguem consegue banir o owner pelo produto.
       'owner_get_stats','owner_get_users','owner_get_metrics',
       'owner_get_audit_logs','owner_get_notifications')
  UNION ALL
  -- SEC-051: o ponto cego. Autorizar por literal nao casa com a heuristica de
  -- cima, entao a funcao ficava invisivel para as outras tres checagens.
  SELECT nome, 'autoriza por LITERAL de papel, sem funcao de hierarquia (SEC-051)'
    FROM f
   WHERE (def ~* 'role\s*=\s*''(owner|super_admin|admin)'''
       OR def ~* 'role\s+IN\s*\(\s*''(owner|super_admin|admin)''')
     AND def !~* 'role_rank|is_staff\(|is_super\(|is_owner\('
     -- As cinco do painel SAIRAM daqui na SEC-054: usam `is_owner()` agora.
     AND nome NOT IN ('operador_ativo')
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
  -- a protecao e ACIDENTAL.
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
  -- SEC-053: POLICY com a hierarquia escrita a mao. `is_staff()`/`is_super()`
  -- embutem `operador_ativo()`; `role_rank(...) >= 2` na policy perde a guarda.
  -- Medido: um admin BANIDO lia a fila inteira e ESCREVIA na wordlist.
  --
  -- SEM LISTA DE EXCECAO desde a SEC-054: as tres policies de `site_config`
  -- passaram a usar `is_owner()`, entao NENHUMA policy precisa de isencao. Lista
  -- vazia e melhor do que lista com nome — ela nao tem onde esconder achado.
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
