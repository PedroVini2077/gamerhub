-- ============================================================================
-- `[25/09]` SEC-052 — toda tabela nova nasce ABERTA, e a documentacao dizia o
--            contrario
-- ============================================================================
--
-- COMO APARECEU
-- -------------
-- Conferindo a fundacao do News, `news_items_raw` — a caixa de entrada da
-- ingestao, que eu criei SEM UM UNICO `GRANT` — apareceu com
-- `DELETE,INSERT,SELECT,UPDATE` para `authenticated`.
--
-- O QUE FOI MEDIDO em `pg_default_acl` do schema `public`
-- --------------------------------------------------------
--   criada por `postgres`        -> authenticated = arwdm
--   criada por `supabase_admin`  -> anon E authenticated = arwdDxtm  (tudo)
--
-- Ou seja: **toda tabela nova nasce aberta**, e nao e preciso escrever grant
-- nenhum para isso acontecer.
--
-- E O `BANCO.md` AFIRMAVA O OPOSTO
-- ----------------------------------
-- Estava escrito: "O `ALTER DEFAULT PRIVILEGES` fecha a tabela nova por
-- padrao, mas nao impede um grant explicito". E o inverso da verdade, e e a
-- pior especie de documentacao errada: ela ensina a NAO conferir. Corrigido
-- no mesmo PR.
--
-- O QUE NAO VAZOU, E POR QUE
-- ---------------------------
-- A RLS de `news_items_raw` esta ligada e sem policy nenhuma, entao o grant
-- nao entregava linha: medido, 0 linhas para `authenticated`.
--
-- Mas e o caso do SEC-005 na letra: "o grant ja estaria la esperando". No dia
-- em que alguem escrever a primeira policy nessa tabela, a caixa de entrada
-- inteira — conteudo de TERCEIRO, nao verificado — vira legivel. Proteger por
-- ausencia de policy e proteger por acidente (§1.3).
--
-- VARREDURA DE CLASSE (§1.3)
-- ---------------------------
-- Toda tabela com grant para anon/authenticated e ZERO policies: eram duas no
-- banco inteiro. `lives_realizadas`, que ja tinha os grants revogados (o
-- desenho certo), e esta. A classe estava contida — mas so porque alguem
-- lembrou, caso a caso.
--
-- POR QUE O AUDITOR GANHA A CHECAGEM, EM VEZ DE UM PORTAO NOVO
-- --------------------------------------------------------------
-- "Alguem lembrar" nao e mecanismo. O `auditoria_de_operadores` (SEC-049) ja e
-- onde o banco se examina, e o `contagem_de_achados_de_seguranca` (SEC-050) ja
-- e ouvido pelo CI com a anon key. Somar a quinta checagem la e mais barato e
-- mais confiavel do que inventar outro (§9.8).

REVOKE ALL ON public.news_items_raw FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.auditoria_de_operadores()
 RETURNS TABLE(funcao text, problema text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT p.oid, p.proname::text AS nome,
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
  -- a protecao e ACIDENTAL. Basta a primeira policy para o grant valer.
  SELECT t.tablename::text,
         'tabela com GRANT para anon/authenticated e ZERO policies (SEC-052)'
    FROM pg_tables t
   WHERE t.schemaname='public'
     AND NOT EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname='public' AND p.tablename=t.tablename)
     AND EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                  WHERE g.table_schema='public' AND g.table_name=t.tablename
                    AND g.grantee IN ('anon','authenticated'))
  ORDER BY 1;
$function$;

COMMENT ON FUNCTION public.auditoria_de_operadores() IS
  'O auditor do banco. Cinco checagens: guarda de operador (SEC-043), autorizacao por literal (SEC-051), trigger chamavel como RPC (SEC-042), funcao alcancavel por anon, e tabela com grant sem policy (SEC-052). Devolve NOMES - fica fechada; quem o CI ouve e contagem_de_achados_de_seguranca.';
