-- SEC-050 · `[24/09]` O auditor existia e ninguem conseguia ouvi-lo.
--
-- ── O que estava errado, e nao era o auditor ────────────────────────────
--
-- A `auditoria_de_operadores()` (SEC-049) ja fazia as TRES checagens que dois
-- itens abertos do backlog pediam:
--
--   1. RPC administrativa que NAO chama `exige_operador_ativo()`  (SEC-043)
--   2. funcao de TRIGGER chamavel como RPC                        (SEC-042)
--   3. funcao alcancavel por ANON fora da lista branca
--
-- So que ela tinha `EXECUTE` revogado de `anon` E de `authenticated`. Ou seja:
-- **so rodava quando eu a chamava a mao pelo MCP.** Auditor que depende de
-- alguem lembrar de perguntar e a mesma classe do §1.5 — a informacao existe e
-- nao chega a lugar nenhum.
--
-- ── Por que NAO abrir o auditor direto para o `anon` ────────────────────
--
-- Ele devolve NOMES. Abrir para `anon` entregaria, para qualquer um na
-- internet, a lista das funcoes fracas do site — um mapa de onde bater.
--
-- Entao entra um mensageiro que devolve **numero**:
--
--     auditoria_de_operadores()          nomes   -> fechada (so `postgres`)
--     contagem_de_achados_de_seguranca() numero  -> aberta para o CI
--
-- **O que isso expoe, dito com todas as letras:** um inteiro, que vale 0
-- quando esta tudo certo. Quem chamar de fora aprende "existem N problemas",
-- nunca quais. A troca e essa, e ela e melhor do que a alternativa — que era
-- nao ter portao nenhum e depender da minha memoria.
--
-- ── Por que pelo `anon` e nao por credencial de banco no CI ─────────────
--
-- Porque ja existe precedente que funciona: o portao `espelho-de-migrations`
-- chama `contagem_de_migrations()` com a anon key. Botar `service_role` no CI
-- seria trocar incerteza de monitoramento por credencial exposta — a conta
-- ruim que este projeto ja recusou tres vezes.
--
-- ── O que isto NAO faz, e e importante ──────────────────────────────────
--
-- Isto e DETECCAO, nao prevencao. A prevencao na raiz seria fechar o
-- `pg_default_acl`, e foi medido em 24/09 que **nao da**: revogar `PUBLIC` do
-- default nao pega, e o default do `supabase_admin` responde `permission
-- denied`. Funcao nova continua nascendo aberta — a diferenca e que agora o CI
-- reprova no mesmo dia, em vez de a brecha viver ate alguem perguntar.
--
-- ── Provado em ROLLBACK ────────────────────────────────────────────────
--
--   hoje o contador diz ........................... 0
--   anon alcanca o mensageiro ..................... sim (e preciso)
--   anon NAO alcanca o auditor (que diz nomes) .... fechado
--   o mensageiro nao se acusa ..................... ok
--   RPC admin NOVA sem a guarda ................... 0 -> 2 achados
--   funcao nova aberta ao anon .................... 2 -> 3 achados
--
-- E contra a PRODUCAO, com a anon key de verdade: `50/50 portas no lugar`,
-- auditor com 0 achados. O caminho de FALHA tambem foi provado — invertendo a
-- expectativa, o portao sai com codigo 1 e imprime as tres classes.

-- O auditor passa a conhecer o mensageiro, senao ele se acusa sozinho e o
-- portao nasce vermelho por causa da propria existencia dele.
CREATE OR REPLACE FUNCTION public.auditoria_de_operadores()
RETURNS TABLE(funcao text, problema text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
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
  SELECT p.proname::text, 'funcao de TRIGGER chamavel como RPC (SEC-042)'
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prorettype='trigger'::regtype
     AND (has_function_privilege('anon', p.oid,'EXECUTE')
       OR has_function_privilege('authenticated', p.oid,'EXECUTE'))
  UNION ALL
  SELECT p.proname::text, 'alcancavel por ANON — confira se e intencional'
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND has_function_privilege('anon', p.oid,'EXECUTE')
     -- As portas publicas documentadas: o portao de espelho do CI, o cadastro,
     -- uma funcao pura que nao le dado, e o mensageiro deste arquivo.
     AND p.proname NOT IN ('contagem_de_migrations','username_disponivel','role_rank',
                           'contagem_de_achados_de_seguranca')
  ORDER BY 1;
$fn$;

-- O mensageiro. Devolve NUMERO, nunca nome — ver o cabecalho.
CREATE OR REPLACE FUNCTION public.contagem_de_achados_de_seguranca()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT count(*)::int FROM auditoria_de_operadores();
$fn$;

REVOKE EXECUTE ON FUNCTION public.contagem_de_achados_de_seguranca() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.contagem_de_achados_de_seguranca() TO anon, authenticated;

-- O auditor continua FECHADO: ele diz nomes.
REVOKE EXECUTE ON FUNCTION public.auditoria_de_operadores() FROM PUBLIC, anon, authenticated;
