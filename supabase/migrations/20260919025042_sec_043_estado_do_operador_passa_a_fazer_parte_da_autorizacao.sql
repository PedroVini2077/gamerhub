-- SEC-043 · `[19/09]` Admin BANIDO ou SUSPENSO continuava mandando no site.
-- Familia N43-N48 de uma auditoria externa, mais UMA porta que o proprio
-- ataque contra esta correcao encontrou.
--
-- ══ A CAUSA-RAIZ, e ela e uma ASSIMETRIA que o projeto ja tinha resolvido
--    do outro lado ═══════════════════════════════════════════════════════
--
-- O projeto ja tem a funcao certa, escrita ha tempos:
--
--     pode_publicar()  ->  NOT banned AND NOT suspended
--
-- Ela e usada nos `WITH CHECK` de INSERT: banido ou suspenso nao PUBLICA.
--
-- Mas quem responde "este usuario pode MODERAR?" e outra coisa:
--
--     is_staff()              ->  role_rank >= 2
--     is_super()              ->  role_rank >= 3
--     can_moderate_content()  ->  rank(caller) > rank(autor)
--
-- **So cargo. Nenhuma olhava o estado operacional.** O projeto aplicou a regra
-- a PUBLICAR e nunca a MODERAR — e e por isso que a familia inteira existe,
-- em vez de serem seis bugs independentes.
--
-- ══ MEDIDO ANTES, com papel `authenticated` real e estado RELIDO ═════════
--
-- Nao "sem excecao": o valor PERSISTIDO no banco depois da chamada.
--
--   N43  admin BANIDO chamou apply_suspension ....... alvo ficou suspenso
--   N44  admin BANIDO chamou ban_user ............... alvo ficou banido
--   N46  super_admin BANIDO chamou unban_user ....... alvo foi desbanido
--        e admin_unlock_login ....................... passou
--   N47  admin SUSPENSO suspendeu e baniu ........... persistiu
--
-- **N45 e N48 (troca de cargo) NAO reproduzem hoje**, e isso e correcao ao
-- relatorio: `admin_set_role` esta sem EXECUTE (SEC-026) e `owner_set_role`
-- exige o fundador. O relatorio os deu como reproduzidos; nao estao.
--
-- ══ A PORTA QUE O ATAQUE CONTRA A PROPRIA CORRECAO ACHOU ════════════════
--
-- A primeira versao desta migration so punha guarda nas RPCs. Ao tentar
-- quebra-la, o admin banido moderou assim mesmo:
--
--     UPDATE posts SET hidden_at = now() WHERE id = ...     -> PERSISTIU
--
-- E o caminho que o `moderationService.setHiddenAt` usa: UPDATE direto, RLS,
-- sem RPC nenhuma. Fechar so a RPC teria deixado a moderacao inteira aberta
-- pela porta ao lado — e o relatorio teria dito "corrigido".
--
-- Por isso a correcao entra nos TRES helpers, e nao so nas funcoes.
--
-- ══ A POLITICA, e de onde ela veio (nao foi inventada) ══════════════════
--
-- O `MODERACAO.md` ja define os dois estados:
--
--   suspensao ... "bloqueia o usuario de CRIAR CONTEUDO... continua navegando"
--   ban ......... "TRANCA O SITE"
--
--   | estado do operador | pode operar? |
--   |--------------------|--------------|
--   | banido             | nao, em nada |
--   | suspenso           | nao age; o site publico continua aberto a ele |
--   | owner              | isento — ver abaixo |
--
-- **Onde eu ESTENDI a documentacao, e digo para poder ser contestado:** a doc
-- fala do usuario comum. Suspender um OPERADOR nunca foi definido. Decidi que
-- suspensao tira tambem a LEITURA administrativa (`admin_list_users` e afins),
-- porque "continua navegando" e sobre o site publico, nao sobre o painel — e
-- porque quem esta punido por abuso nao deveria seguir lendo email de usuario.
-- E temporario e reversivel, entao errar para o lado restritivo custa pouco.
--
-- ══ O OWNER e ISENTO, e a razao foi MEDIDA ══════════════════════════════
--
--   role_rank('owner') = 4 · maior rank nao-owner = 2
--   `ban_user` exige rank(caller) > rank(alvo)
--
-- Logo **ninguem consegue banir o owner pelo produto**. Isenta-lo nao abre
-- caminho nenhum no modelo de ameaca; NAO isenta-lo cria um travamento sem
-- volta, porque nao existe autoridade acima dele para restaurar o acesso.
--
-- ══ POR QUE NAO MEXI EM `role_rank()` ═══════════════════════════════════
--
-- Ele tambem calcula o rank do ALVO. Misturar o estado do chamador ali faria
-- "banir alguem banido" mudar de significado. `role_rank` continua puro.
--
-- ══ PROVADO EM ROLLBACK — 12 asercoes, ataque E regressao ═══════════════
--
--   A1 admin banido: UPDATE direto de hidden_at ..... porta fechada
--   A2 soft_delete_post ............................. recusado
--   A3 notify_user .................................. recusado
--   A4 admin_list_users ............................. recusado
--   A5 apply_suspension ............................. recusado
--   B1 admin SUSPENSO: UPDATE direto ................ porta fechada
--   C1 admin SAUDAVEL continua ocultando ............ OK   <- a licao do SEC-025
--   C2 admin SAUDAVEL continua lendo o painel ....... OK
--   C3 admin SAUDAVEL continua suspendendo .......... OK
--   D1 usuario comum continua publicando ............ OK
--   D2 usuario comum continua apagando o proprio .... OK
--   E1 owner (mesmo marcado banido) continua ........ isento

-- ── A politica, em UM lugar, com DUAS formas ───────────────────────────
-- Booleana para a RLS (policy nao levanta excecao) e que-levanta para a RPC
-- (o usuario precisa saber POR QUE foi recusado). A segunda chama a primeira:
-- fonte unica de verdade (§4).
CREATE OR REPLACE FUNCTION public.operador_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((
    SELECT role = 'owner'
        OR (NOT COALESCE(banned,false)
            AND (suspended_until IS NULL OR suspended_until <= now()))
      FROM profiles WHERE id = (SELECT auth.uid())
  ), false);
$fn$;

COMMENT ON FUNCTION public.operador_ativo() IS
  'SEC-043: o chamador pode exercer poder administrativo AGORA? Cargo e uma coisa (role_rank); estado operacional e outra. Owner e isento porque ninguem consegue bani-lo pelo produto.';

CREATE OR REPLACE FUNCTION public.exige_operador_ativo()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_banido boolean; v_susp timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Precisa estar autenticado.'; END IF;
  IF operador_ativo() THEN RETURN; END IF;
  SELECT COALESCE(banned,false), suspended_until INTO v_banido, v_susp
    FROM profiles WHERE id = auth.uid();
  IF v_banido THEN
    RAISE EXCEPTION 'Sua conta esta banida — acoes administrativas estao bloqueadas.';
  END IF;
  RAISE EXCEPTION 'Sua conta esta suspensa ate %. Acoes administrativas estao bloqueadas.',
    to_char(v_susp, 'DD/MM/YYYY HH24:MI');
END;
$fn$;

-- SEC-042: funcao nova nasce com EXECUTE para `anon`. Fechando na hora.
REVOKE EXECUTE ON FUNCTION public.exige_operador_ativo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.operador_ativo()       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.operador_ativo()       TO authenticated;

-- ── A porta da RLS: 24 policies herdam isto de uma vez ─────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
     AND operador_ativo();
$fn$;

CREATE OR REPLACE FUNCTION public.is_super()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 3
     AND operador_ativo();
$fn$;

CREATE OR REPLACE FUNCTION public.can_moderate_content(author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT role_rank((SELECT role FROM profiles WHERE id = auth.uid()))
       > role_rank((SELECT role FROM profiles WHERE id = author_id))
     AND operador_ativo();
$fn$;

-- ── A porta das RPCs: 25 funcoes administrativas ───────────────────────
--
-- Injecao MECANICA em vez de recopiar 25 corpos a mao: transcrever cada um
-- seria a chance de errar 25 vezes. O `regexp_replace(..., 1, 1)` troca so a
-- PRIMEIRA ocorrencia, e a guarda abaixo confere que esse primeiro `BEGIN` e
-- o mesmo no texto cru e no texto SEM COMENTARIOS — senao eu estaria
-- escrevendo codigo dentro de PROSA, armadilha que ja me pegou 10 vezes.
DO $inj$
DECLARE r record; v_def text; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
     WHERE n2.nspname = 'public' AND p.proname IN (
       'apply_suspension','lift_suspension','ban_user','unban_user',
       'approve_unban_request','deny_unban_request','admin_unlock_login',
       'decide_role_demotion','nominate_staff','review_staff_nomination',
       'decide_staff_trial','soft_delete_post','restore_post','notify_user',
       'notify_owner','admin_delete_unconfirmed_user','owner_set_site_config',
       'contato_registrar_resposta','request_role_demotion','admin_set_role',
       'owner_set_role','admin_list_users','admin_get_unconfirmed_users',
       'get_blocked_logins','contato_dados_para_resposta')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF v_def ~* 'exige_operador_ativo' THEN CONTINUE; END IF;
    IF strpos(upper(v_def),'BEGIN') = 0
       OR strpos(upper(v_def),'BEGIN')
        <> strpos(upper(regexp_replace(v_def,'--[^\n]*',' ','g')),'BEGIN') THEN
      RAISE EXCEPTION 'Nao injetei em %: o 1o BEGIN nao e confiavel (comentario?).', r.proname;
    END IF;
    EXECUTE regexp_replace(v_def, '\mBEGIN\M',
      E'BEGIN\n  PERFORM public.exige_operador_ativo();', 1, 1, 'i');
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'SEC-043: guarda injetada em % RPCs', n;
END $inj$;
