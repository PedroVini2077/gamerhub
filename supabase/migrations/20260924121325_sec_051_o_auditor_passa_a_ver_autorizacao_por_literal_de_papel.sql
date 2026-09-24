-- SEC-051 · `[24/09]` O auditor nao via autorizacao escrita por LITERAL.
--
-- ── Como isto apareceu ──────────────────────────────────────────────────
--
-- A parte 1 da auditoria pedia que os quatro `400 Acesso negado` que o dono
-- reproduziu no DevTools virassem regressao. Ao conferir as quatro funcoes,
-- uma delas — `owner_get_stats` — nao usava `role_rank`, `is_staff`,
-- `is_super` nem `is_owner`. Ela autoriza assim:
--
--     IF NOT EXISTS (SELECT 1 FROM profiles
--                     WHERE id = auth.uid() AND role = 'owner') THEN
--
-- Isso NAO e vulnerabilidade: o efeito e correto, so o fundador passa. Mas e a
-- forma que o `POSTURA.md` proibe — "hierarquia nunca se escreve a mao" —, e
-- ela ja causou TRES falhas neste projeto, sempre por alguem esquecer `owner`
-- numa lista literal.
--
-- ── E era um PONTO CEGO do proprio auditor ──────────────────────────────
--
-- A heuristica da SEC-049 procura `role_rank|is_staff|is_super|is_owner` para
-- decidir "isto e administrativo". Funcao que autoriza por literal **nao casa
-- com nenhum deles** — entao ela era invisivel para as tres checagens.
--
-- Eu registrei esse risco residual no BACKLOG.md hoje de manha, com estas
-- palavras: *"uma RPC administrativa que decidisse permissao por outro caminho
-- nao seria vista"*. A varredura de classe achou SEIS.
--
-- ── A varredura, e o que ela devolveu ───────────────────────────────────
--
--   operador_ativo .......... e a propria maquinaria da guarda (compara papel
--                             por desenho)
--   owner_get_stats ......... painel do Fundador
--   owner_get_users ......... painel do Fundador
--   owner_get_metrics ....... painel do Fundador
--   owner_get_audit_logs .... painel do Fundador
--   owner_get_notifications . painel do Fundador
--
-- ── Por que as cinco do painel ficam ISENTAS, e nao consertadas aqui ────
--
-- Duas razoes, e as duas sao para NAO agir por conta propria:
--
-- 1. **Trocar o literal por `is_owner()` nao e mecanico.** `is_owner()` e
--    `role_rank(...) >= 4`; o literal e `= 'owner'`. Hoje dao o mesmo
--    resultado, mas um cargo futuro de rank 5 passaria num e nao no outro.
--    Isso e decisao de semantica, nao limpeza — §7 🟡.
--
-- 2. **Por o `exige_operador_ativo()` nelas seria pior.** Elas sao o painel do
--    PROPRIO fundador, e ninguem consegue bani-lo: `ban_user` e
--    `apply_suspension` tem hierarquia estrita (`role_rank(caller) <=
--    role_rank(alvo)` recusa) e o fundador e o topo. Guardar a leitura do
--    painel dele criaria o risco de tranca-lo para FORA do proprio painel, sem
--    inversa — a classe do erro que a `apply_suspension` sem `lift_suspension`
--    cometeu.
--
-- As duas estao propostas no `BACKLOG.md`. Ate la, os nomes ficam na lista de
-- excecao **com o motivo escrito aqui** — e a trava
-- `auditorDoBancoEhOuvido.test.js` reprova se a lista crescer em silencio.
--
-- ── O que muda de verdade ───────────────────────────────────────────────
--
-- A partir daqui, funcao NOVA que autorize por literal de papel e **vista**. O
-- ponto cego fecha para o futuro, que e onde ele doia.
--
-- ── Provado em ROLLBACK ────────────────────────────────────────────────
--
--   achados agora ............................... 0 (o portao segue verde)
--   funcao nova com LITERAL ..................... detectada, so pelo achado certo
--   REGRESSAO: funcao com `role_rank` + guarda ... nao e acusada
--   REGRESSAO: as 5 do painel seguem isentas ..... ok

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
  -- SEC-051: o ponto cego. Autorizar por literal nao casa com a heuristica de
  -- cima, entao a funcao ficava invisivel para as outras tres checagens.
  SELECT nome, 'autoriza por LITERAL de papel, sem funcao de hierarquia (SEC-051)'
    FROM f
   WHERE (def ~* 'role\s*=\s*''(owner|super_admin|admin)'''
       OR def ~* 'role\s+IN\s*\(\s*''(owner|super_admin|admin)''')
     AND def !~* 'role_rank|is_staff\(|is_super\(|is_owner\('
     AND nome NOT IN (
       -- a propria maquinaria da guarda: compara papel por desenho
       'operador_ativo',
       -- o painel do PROPRIO fundador. Trocar o literal por `is_owner()` muda
       -- semantica (rank >= 4 vs = 'owner'), e por a guarda de operador
       -- arriscaria tranca-lo fora do painel sem inversa. Proposto no BACKLOG.
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
  ORDER BY 1;
$fn$;

REVOKE EXECUTE ON FUNCTION public.auditoria_de_operadores() FROM PUBLIC, anon, authenticated;
