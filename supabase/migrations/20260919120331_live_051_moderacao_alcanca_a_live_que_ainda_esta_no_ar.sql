-- LIVE-051 · `[19/09]` A invalidacao da moderacao so alcancava sessao que JA
-- EXISTIA — e live no ar ainda nao tem sessao.
--
-- Achado pela varredura de CLASSE do LIVE-050 (POSTURA.md §1.3: "onde mais
-- esse mesmo padrao existe?"). O LIVE-050 fechou `is_live` x `deleted_at`;
-- este fecha o par irmao `is_live` x `hidden_at` e o buraco de ORDEM que os
-- dois compartilhavam.
--
-- ── O mecanismo, em uma frase ───────────────────────────────────────────
--
-- `invalidar_lives_do_post_moderado` faz `UPDATE lives_realizadas ... WHERE
-- post_id = NEW.id`. Uma live que esta NO AR nao tem linha nenhuma ali, entao
-- moderar nao invalida nada — e a sessao que nasce depois nunca e revisitada.
--
-- ── As duas portas, as duas MEDIDAS em ROLLBACK ─────────────────────────
--
-- OCULTAR uma live no ar:
--   `is_live` continuava `true` com `hidden_at` preenchido (estado impossivel,
--   mesma classe do LIVE-050), a sessao nascia quando a live encerrasse, e
--   `lives` no XP ia de 0 para 1.
--
-- APAGAR uma live no ar, pela equipe:
--   a sessao nasce no MESMO statement, e os AFTER disparam em ordem
--   alfabetica: `trg_invalidar_lives_moderadas` < `trg_registrar_live_realizada`.
--   A invalidacao roda ANTES de a sessao existir. `lives` no XP: 0 -> 1.
--
-- Nos dois casos a punicao da moderacao nao alcancava o XP — que e o achado
-- N8, que a LIVE-040 fechou **so para a live que ja tinha acabado**.
--
-- E a live OCULTA continuava listada como "AO VIVO" para quem e da equipe
-- (`fetchActiveLives` filtrava `deleted_at` e nao `hidden_at`), repetindo a
-- armadilha que o SEC-034 descreve: a RLS esconde o problema de todo mundo
-- menos de quem mais olha aquela tela. Medido: comum ve 0, equipe ve 1.
--
-- ── A correcao e na CERTIDAO DE NASCIMENTO, nao em mais uma varredura ───
--
-- Adiar a invalidacao ou renomear o trigger para inverter a ordem fecharia so
-- a porta do apagar: o ocultar encerra a live minutos depois, em OUTRO
-- statement. Por isso a sessao passa a NASCER invalidada quando o post esta
-- sob moderacao — e a varredura retrospectiva continua existindo para a live
-- que ja tinha acabado. Duas camadas independentes, de proposito.
--
-- ── Por que o motivo virou FUNCAO ───────────────────────────────────────
--
-- A inversa (restaurar devolve o XP) casa por `invalidada_motivo`. Com o texto
-- escrito em dois lugares, mudar um deixaria o outro orfao e a inversa pararia
-- de achar as linhas — em silencio (§1.5). `motivo_de_invalidacao()` e a fonte
-- unica (§4).

CREATE OR REPLACE FUNCTION public.motivo_de_invalidacao(
  p_hidden_at timestamptz, p_deleted_at timestamptz, p_ator uuid, p_autor uuid)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE
    -- So quem tem role_rank >= 2 grava `hidden_at` (o guard do SEC-027 fixa a
    -- coluna para o autor), entao ocultar E sempre moderacao.
    WHEN p_hidden_at IS NOT NULL THEN 'ocultada pela moderacao'
    -- Apagado por OUTRA pessoa que nao o autor = moderacao. O autor apagando o
    -- proprio post NAO perde o XP: a live aconteceu, e apagar o registro dela
    -- depois nao desfaz o tempo transmitido.
    WHEN p_deleted_at IS NOT NULL AND p_ator IS NOT NULL AND p_ator <> p_autor
      THEN 'apagada pela equipe'
  END;
$fn$;

-- ── 1. A sessao NASCE invalidada quando o post esta sob moderacao ───────

CREATE OR REPLACE FUNCTION public.registrar_live_realizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_motivo text;
BEGIN
  -- LIVE-050: `OLD.deleted_at IS NULL` — a sessao so conta se o post estava NO
  -- AR durante ela. Apagar enquanto live continua registrando (SEC-034);
  -- ciclar um post JA apagado nao registra nada, porque ninguem podia ver.
  IF COALESCE(OLD.is_live,false) = true AND COALESCE(NEW.is_live,false) = false
     AND OLD.deleted_at IS NULL THEN

    -- LIVE-051: o estado do post AGORA decide se a sessao ja nasce invalidada.
    -- Sem isto, moderar uma live NO AR nao alcanca o XP: a varredura
    -- retrospectiva rodou quando esta linha ainda nao existia.
    v_motivo := motivo_de_invalidacao(NEW.hidden_at, NEW.deleted_at,
                                      auth.uid(), NEW.user_id);

    INSERT INTO lives_realizadas (user_id, post_id, titulo, live_kind,
                                  iniciada_em, encerrada_em,
                                  invalidada_em, invalidada_motivo)
    VALUES (NEW.user_id, NEW.id, COALESCE(NEW.title,'(sem título)'), NEW.live_kind,
            COALESCE(NEW.live_started_at, NEW.created_at),
            COALESCE(NEW.live_ended_at, now()),
            CASE WHEN v_motivo IS NULL THEN NULL ELSE now() END,
            v_motivo);
  END IF;
  RETURN NEW;
END;
$fn$;

-- ── 2. A varredura retrospectiva passa a usar a MESMA fonte ─────────────

CREATE OR REPLACE FUNCTION public.invalidar_lives_do_post_moderado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_motivo text;
BEGIN
  -- A INVERSA (BANCO.md): restaurar devolve o XP. So desfaz o que ESTA
  -- invalidacao causou — uma live apagada pela equipe continua invalidada.
  IF OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL THEN
    UPDATE lives_realizadas SET invalidada_em = NULL, invalidada_motivo = NULL
     WHERE post_id = NEW.id
       AND invalidada_motivo = motivo_de_invalidacao(now(), NULL, NULL, NULL);
    RETURN NEW;
  END IF;

  -- So age na TRANSICAO para moderado — nao a cada UPDATE de um post ja oculto.
  IF (OLD.hidden_at IS NULL  AND NEW.hidden_at  IS NOT NULL)
  OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    v_motivo := motivo_de_invalidacao(NEW.hidden_at, NEW.deleted_at,
                                      auth.uid(), NEW.user_id);
    IF v_motivo IS NOT NULL THEN
      UPDATE lives_realizadas SET invalidada_em = now(), invalidada_motivo = v_motivo
       WHERE post_id = NEW.id AND invalidada_em IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- ── 3. Ocultar uma live NO AR encerra ela, e live oculta nao volta ──────

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

  -- SEC-034 / LIVE-051: sair do ar por moderacao encerra a live junto. Eram
  -- dois pares da MESMA classe e so um estava escrito.
  IF COALESCE(OLD.is_live,false)
     AND ((OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
       OR (OLD.hidden_at  IS NULL AND NEW.hidden_at  IS NOT NULL)) THEN
    NEW.is_live := false;
  END IF;

  -- LIVE-050 / LIVE-051: post fora do ar nao volta a transmitir. Levanta em vez
  -- de forcar `false` em silencio — o painel precisa dizer POR QUE o botao nao
  -- fez nada (`useAdminLiveActions` mostra `err.message` no toast).
  IF COALESCE(NEW.is_live,false) AND NOT COALESCE(OLD.is_live,false) THEN
    IF NEW.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Esta live foi apagada. Restaure o post antes de reativar.';
    ELSIF NEW.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'Esta live esta oculta pela moderacao. Restaure o post antes de reativar.';
    END IF;
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

-- SEC-042: funcao de trigger nao e RPC. Sem isto elas nascem chamaveis por
-- `anon` em `/rest/v1/rpc/`, por causa do `pg_default_acl` do schema.
REVOKE EXECUTE ON FUNCTION public.motivo_de_invalidacao(timestamptz, timestamptz, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_live_realizada()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invalidar_lives_do_post_moderado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_live_ended_at()                FROM PUBLIC, anon, authenticated;

-- ── 4. O auto-ocultar da wordlist tira a live do ar no MESMO passo ──────
--
-- `trg_wordlist_posts` e BEFORE INSERT e roda DEPOIS do `trg_set_live_ended_at`
-- (ordem alfabetica), entao o guard acima nao enxerga este `hidden_at`. Sem
-- esta linha, um post de live com termo `high` nasceria oculto E no ar — e o
-- CHECK abaixo recusaria a PUBLICACAO inteira em vez de ocultar, que seria a
-- classe do erro do SEC-025 (correcao de seguranca derrubando o caminho feliz).
--
-- A injecao e MECANICA — `pg_get_functiondef` + `replace` — para nao reescrever
-- a mao uma funcao cujo `regexp_replace` de escape eu ja mangui uma vez nesta
-- sessao. A contagem da ancora usa `replace`/`length` e NAO regex: os
-- parenteses de `now()` viram grupo vazio num padrao, e o meu proprio
-- verificador deu 0 ocorrencias sobre um texto que tinha 1.

DO $inj$
DECLARE
  v_def  text;
  v_txt  text;
  v_nu   int;
  v_alvo constant text := 'NEW.hidden_at := now();';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'checar_palavras_bloqueadas';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'checar_palavras_bloqueadas nao existe — a ancora sumiu.';
  END IF;

  -- Prosa cita comando: a ancora e contada no texto SEM comentario.
  v_txt := regexp_replace(v_def, E'--[^\n]*', ' ', 'g');
  v_nu  := (length(v_txt) - length(replace(v_txt, v_alvo, ''))) / length(v_alvo);

  IF v_nu <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 ocorrencia de "%" e achei %. Injecao abortada.',
      v_alvo, v_nu;
  END IF;

  EXECUTE replace(v_def, v_alvo, v_alvo || E'\n'
    || '    -- LIVE-051: oculto E no ar e o estado impossivel que o CHECK barra.' || E'\n'
    || '    IF TG_TABLE_NAME = ''posts'' THEN NEW.is_live := false; END IF;');
END
$inj$;

-- ── 5. A camada de 1a forca, irma do LIVE-050 ──────────────────────────
--
-- Provado em ROLLBACK que publicar um post de live com termo `high` continua
-- publicando (oculto e fora do ar) — o passo 4 e pre-requisito deste CHECK.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_live_oculta_nao_fica_no_ar;
ALTER TABLE public.posts ADD CONSTRAINT posts_live_oculta_nao_fica_no_ar
  CHECK (NOT (COALESCE(is_live,false) AND hidden_at IS NOT NULL));
