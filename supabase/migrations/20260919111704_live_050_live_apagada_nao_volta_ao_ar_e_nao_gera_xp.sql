-- LIVE-050 · `[19/09]` Live APAGADA voltava ao ar pelo painel — e cada volta
-- gravava uma sessao em `lives_realizadas`, que paga XP.
--
-- Bug relatado pelo dono testando o site: *"assim que exclui um post de live,
-- eu consigo ativar e reativar a live mesmo estando apagado, lá pelo painel"*.
--
-- ── O que eu medi, e era pior do que o relato ────────────────────────────
--
-- Reproduzido em ROLLBACK, com o post ja apagado:
--
--   0_estado_apos_apagar         is_live=false  deleted_at=SIM
--   1_apos_REATIVAR_pelo_painel  is_live=true   deleted_at=SIM  live_ended_at=null
--   2_ESTADO_IMPOSSIVEL          SIM — no ar E apagado ao mesmo tempo
--   3_aparece_no_fetchActiveLives  nao (o filtro `deleted_at` segura)
--   4_sessoes_registradas        2
--
-- A linha 3 e a que engana: a tela NAO mostrava a live, entao o sintoma
-- visivel era so o botao do painel se comportando como se funcionasse. A linha
-- 4 e o estrago real — cada ciclo ativar/desativar de um post apagado gravava
-- uma sessao em `lives_realizadas`, e a view de XP paga por sessao registrada.
-- Um post apagado virava uma maquina de XP acionavel pelo painel.
--
-- ── A causa raiz: o CHECK do SEC-034 cobria o PAR ERRADO ─────────────────
--
-- O SEC-034 ja tinha decidido que "no ar" e "encerrada" sao estados que nao
-- coexistem, e travou isso com `posts_live_no_ar_nao_tem_fim`
-- (`is_live` × `live_ended_at`). Mas o par `is_live` × `deleted_at` ficou de
-- fora — mesma CLASSE de estado impossivel, coluna diferente.
--
-- O `set_live_ended_at` tinha o caminho de IDA (apagar uma live no ar encerra
-- ela) e nao tinha a VOLTA (reativar uma live apagada). Caminho de ida escrito
-- sem a inversa e exatamente o padrao que o `docs/regras/BANCO.md` descreve.
--
-- ── As tres camadas, porque uma so nao fecha ─────────────────────────────
--
-- 1. `set_live_ended_at` RECUSA reativar post apagado, com `RAISE EXCEPTION`.
--    Levantar em vez de forcar `false` em silencio e deliberado (§1.5): o
--    painel ja faz `toast.error('Erro ao reativar: ' + err.message)`, entao a
--    mensagem chega na tela de quem clicou. Forcar `false` daria um botao que
--    nao faz nada e nao explica.
--
-- 2. `registrar_live_realizada` exige `OLD.deleted_at IS NULL` — a sessao so
--    conta se o post estava NO AR durante ela. Isso e independente da camada 1
--    de proposito: se algum caminho futuro reabrir a brecha do estado, o XP
--    continua fechado.
--
-- 3. CHECK `posts_live_apagada_nao_fica_no_ar` — o estado passa a ser
--    IMPOSSIVEL de existir, venha de onde vier (REST API, trigger novo, UPDATE
--    cru). E a trava de 1a forca da tabela do §2.
--
-- Verificado em producao ANTES de criar o CHECK: `posts_no_estado_impossivel`
-- = 0 e `sessoes_validas_em_post_apagado` = 0, entao nenhum dado existente
-- precisava de limpeza.
--
-- ── Provado em ROLLBACK, com papel `authenticated` real ──────────────────
--
--   A1 reativar apagada ............ OK: Esta live foi apagada. Restaure...
--   A2 EFEITO: continua fora do ar . OK
--   A3 sessoes geradas no apagado .. 0   (eram 2)
--   A4 forjar estado direto ........ OK: barrado pelo CHECK
--   R1 reativar live NORMAL ........ OK: passou
--   R2 EFEITO: voltou ao ar ........ OK
--   R3 apagar live NO AR encerra ... OK
--   R4 apagar live NO AR registra .. OK: 1 sessao
--
-- As quatro assercoes `R` sao regressao: o caminho feliz da live e o caminho
-- de ida do SEC-034 continuam de pe. Sem elas eu estaria provando so que o
-- bloqueio bloqueia — que e a licao do SEC-025.
--
-- ── `SECURITY DEFINER`: o que tem e o que NAO tem ───────────────────────
--
-- `set_live_ended_at` continua SEM `SECURITY DEFINER`. Ela e guarda de coluna
-- e precisa rodar como QUEM CHAMA. Foi esse exato erro que quase reverteu o
-- SEC-027 inteiro no PR #217, e a trava `prazoDaLive.test.js` existe
-- por causa dele.
--
-- `registrar_live_realizada` mantem `SECURITY DEFINER` porque escreve em
-- `lives_realizadas`, que o autor nao alcanca por RLS.
--
-- Ambas continuam com `REVOKE EXECUTE` — funcao de trigger nasce chamavel por
-- `anon` via `/rest/v1/rpc/` por causa do `pg_default_acl` (SEC-042).

CREATE OR REPLACE FUNCTION public.set_live_ended_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_live,false) THEN NEW.live_started_at := now(); END IF;
    RETURN NEW;
  END IF;

  -- SEC-034: apagar uma live que esta no ar encerra ela junto.
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
     AND COALESCE(OLD.is_live,false) THEN
    NEW.is_live := false;
  END IF;

  -- LIVE-050: post APAGADO nao volta ao ar. Levanta em vez de forcar `false`
  -- em silencio — o painel precisa dizer POR QUE o botao nao fez nada.
  IF COALESCE(NEW.is_live,false) AND NOT COALESCE(OLD.is_live,false)
     AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta live foi apagada. Restaure o post antes de reativar.';
  END IF;

  IF COALESCE(NEW.is_live,false) = false AND COALESCE(OLD.is_live,false) = true THEN
    NEW.live_ended_at := now();
  ELSIF COALESCE(NEW.is_live,false) = true AND COALESCE(OLD.is_live,false) = false THEN
    NEW.live_ended_at   := NULL;
    NEW.live_started_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.registrar_live_realizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- LIVE-050: `OLD.deleted_at IS NULL` — a sessao so conta se o post estava NO
  -- AR durante ela. Apagar enquanto live continua registrando (SEC-034);
  -- ciclar um post JA apagado nao registra nada, porque ninguem podia ver.
  IF COALESCE(OLD.is_live,false) = true AND COALESCE(NEW.is_live,false) = false
     AND OLD.deleted_at IS NULL THEN
    INSERT INTO lives_realizadas (user_id, post_id, titulo, live_kind, iniciada_em, encerrada_em)
    VALUES (NEW.user_id, NEW.id, COALESCE(NEW.title,'(sem título)'), NEW.live_kind,
            COALESCE(NEW.live_started_at, NEW.created_at),
            COALESCE(NEW.live_ended_at, now()));
  END IF;
  RETURN NEW;
END;
$fn$;

-- SEC-042: funcao de trigger nao e RPC. Sem isto elas nascem chamaveis por
-- `anon` em `/rest/v1/rpc/`, porque o `pg_default_acl` do schema da EXECUTE a
-- toda funcao criada pelo `postgres`.
REVOKE EXECUTE ON FUNCTION public.registrar_live_realizada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_live_ended_at()        FROM PUBLIC, anon, authenticated;

-- A 3a camada, e a unica de 1a forca (§2): o estado passa a ser IMPOSSIVEL.
-- Irma do `posts_live_no_ar_nao_tem_fim` (SEC-034) — mesma classe, o par de
-- colunas que tinha ficado de fora.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_live_apagada_nao_fica_no_ar;
ALTER TABLE public.posts ADD CONSTRAINT posts_live_apagada_nao_fica_no_ar
  CHECK (NOT (COALESCE(is_live,false) AND deleted_at IS NOT NULL));

