-- ─────────────────────────────────────────────────────────────────────────────
-- A INVERSA DO PONTO DE INFRAÇÃO — §5 ("toda ação de estado precisa da INVERSA")
--
-- O QUE ESTAVA ERRADO, e foi medido em 03/10 durante um CI vermelho:
--
--   1. `handle_violation_escalation` somava `SUM(points) WHERE user_id = ...`
--      SEM NENHUM recorte: a vida inteira da conta, para sempre.
--   2. `lift_suspension` zerava `suspended_until` e NÃO tocava em `violations`.
--      Com 8 pontos guardados e limiar 8, a próxima infração de qualquer
--      tamanho voltava a cruzar o limiar — o perdão do moderador era desfeito
--      pela infração seguinte, e a RPC parecia funcionar.
--   3. Nada no banco inteiro lia ou escrevia `violations` além do próprio
--      gatilho de escalada (conferido em `pg_proc`): não existia caminho
--      nenhum, em tela ou em SQL, para perdoar um ponto.
--
-- COMO ISSO APARECEU: o roteiro `e2e/duasContas.mjs` oculta um post por
-- execução. Quatro execuções × 2 pontos = exatamente o `mod_suspend_threshold`,
-- e a conta de teste foi suspensa por 7 dias — derrubando DOIS roteiros de uma
-- vez, porque `LinhaDePublicar` devolve `null` para quem está suspenso e ir ao
-- vivo é recusado. O roteiro restaurava o post e NÃO desfazia o ponto.
--
-- A ESCOLHA DE DESENHO, e ela é a razão deste arquivo existir:
--
--   REVOGAR, não APAGAR. A violação continua na tabela com quem revogou,
--   quando e por quê. Apagar a linha resolveria a soma e destruiria a trilha —
--   e infração que desaparece sem rastro é indistinguível de bug (§1.5).
--
--   A INVERSA MORA NA CLASSE, não no caso. Restaurar conteúdo oculto é a
--   inversa de ocultá-lo, e ela pertence a QUALQUER caminho que limpe
--   `hidden_at`: o painel do admin, a fila de moderação, o roteiro de E2E e os
--   caminhos que ainda não existem. Por isso é TRIGGER nas tabelas de conteúdo,
--   e não código dentro de um service — exatamente o padrão que
--   `resolver_moderacao_de_conteudo_apagado` já estabeleceu para o DELETE.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Absorve um comentário que foi aplicado solto ──────────────────────────
-- Eu usei o histórico de migrations como teste de porta (o `execute_sql` do MCP
-- cancela escrita; o `apply_migration` passa) e deixei uma migration chamada
-- `infracao_tem_inversa_teste_de_porta` com só este COMMENT. Ele está repetido
-- aqui para o histórico ficar coerente: quem ler só este arquivo vê a mudança
-- inteira, sem depender de uma migration cujo nome anuncia que era um teste.
COMMENT ON TABLE public.violations IS
  'Infrações de moderação. Pontos somam para a escalada automática — e só contam enquanto `revogada_em` for NULL.';

-- ── 1. As colunas da revogação ───────────────────────────────────────────────

ALTER TABLE public.violations
  ADD COLUMN IF NOT EXISTS revogada_em     timestamptz,
  ADD COLUMN IF NOT EXISTS revogada_por    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revogada_motivo text;

COMMENT ON COLUMN public.violations.revogada_em IS
  'Quando a infração deixou de contar para a escalada. A linha FICA: revogar nao e apagar, e a trilha precisa continuar legivel.';
COMMENT ON COLUMN public.violations.revogada_por IS
  'Quem revogou. NULL com revogada_em preenchido = revogacao automatica (conteudo restaurado), e o motivo diz qual foi.';

-- `revogada_motivo` é obrigatório quando há revogação: revogação sem motivo é
-- a linha que ninguém consegue explicar seis meses depois.
ALTER TABLE public.violations
  DROP CONSTRAINT IF EXISTS violations_revogacao_tem_motivo;
ALTER TABLE public.violations
  ADD CONSTRAINT violations_revogacao_tem_motivo
  CHECK (revogada_em IS NULL OR btrim(coalesce(revogada_motivo, '')) <> '');

-- A escalada passa a filtrar por `revogada_em IS NULL`, então o índice cobre
-- exatamente a consulta que o gatilho faz a cada infração registrada.
CREATE INDEX IF NOT EXISTS violations_user_vivas_idx
  ON public.violations (user_id) WHERE revogada_em IS NULL;

-- ── 2. A escalada só conta infração VIVA ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_violation_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total   int;
  v_ban_thr int;
  v_sus_thr int;
BEGIN
  -- `revogada_em IS NULL` e a mudanca desta migration. Sem ela, infracao
  -- perdoada continuava pesando e o perdao era decorativo.
  SELECT COALESCE(SUM(points), 0) INTO v_total
    FROM violations
   WHERE user_id = NEW.user_id AND revogada_em IS NULL;

  SELECT COALESCE(value::int, 15) INTO v_ban_thr FROM site_config WHERE key = 'mod_ban_threshold';
  SELECT COALESCE(value::int, 8)  INTO v_sus_thr FROM site_config WHERE key = 'mod_suspend_threshold';

  IF v_total >= v_ban_thr THEN
    PERFORM apply_mod_auto_ban(NEW.user_id, v_total);
  ELSIF v_total >= v_sus_thr THEN
    PERFORM apply_mod_auto_suspend(NEW.user_id, v_total);
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 3. A INVERSA automática: conteúdo restaurado revoga a infração ───────────

CREATE OR REPLACE FUNCTION public.revogar_infracao_de_conteudo_restaurado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo      text;
  v_revogadas int;
  v_pontos    int;
  v_quem      text;
BEGIN
  -- Mapa FECHADO, com RAISE no else. `resolver_moderacao_de_conteudo_apagado`
  -- usa `ELSE 'chat'`, e aqui isso seria errado: chat nao tem `hidden_at`, logo
  -- tabela desconhecida neste gatilho e erro de instalacao, nao um caso a
  -- adivinhar (§4, fallback silencioso).
  v_tipo := CASE TG_TABLE_NAME
              WHEN 'posts'           THEN 'post'
              WHEN 'comments'        THEN 'comment'
              WHEN 'community_posts' THEN 'mural'
            END;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'revogar_infracao_de_conteudo_restaurado instalada em tabela sem mapa: %', TG_TABLE_NAME;
  END IF;

  UPDATE violations
     SET revogada_em     = now(),
         revogada_por    = NULL,     -- automatica: nao foi decisao de uma pessoa
         revogada_motivo = 'conteudo restaurado — a ocultacao que gerou esta infracao foi desfeita'
   WHERE content_type = v_tipo
     AND content_id   = OLD.id
     AND revogada_em IS NULL;

  GET DIAGNOSTICS v_revogadas = ROW_COUNT;
  IF v_revogadas = 0 THEN
    RETURN NEW;   -- restauracao de conteudo que nunca gerou infracao: normal
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_pontos
    FROM violations
   WHERE content_type = v_tipo AND content_id = OLD.id AND revogada_por IS NULL
     AND revogada_motivo LIKE 'conteudo restaurado%';

  -- GRITA (§1.5): ponto de infracao que some sozinho, sem nada gravado, e
  -- indistinguivel de bug. A trilha e o unico lugar onde isto aparece, porque
  -- quem restaurou o conteudo nao pediu para perdoar ponto nenhum.
  --
  -- O INSERT e direto, e NAO pelo `log_audit_event`, de proposito: aquela e a
  -- porta do CLIENTE, com lista fechada de actions, e `trilhaNaoEhForjavel`
  -- existe para impedir que o cliente registre o que o banco nao autoriza. Pôr
  -- `violation_revoked` naquela lista a tornaria forjavel de fora.
  --
  -- `admin_username` e NOT NULL — a 1a versao desta migration nao o preenchia e
  -- o teste em ROLLBACK reprovou com "null value in column admin_username".
  -- O COALESCE copia a convencao do proprio `log_audit_event`: aqui ele nao e
  -- chute, e o rotulo honesto de "nenhuma pessoa logada fez isto" (§4).
  v_quem := (SELECT username FROM profiles WHERE id = auth.uid());

  INSERT INTO admin_logs (action, details, category, severity, metadata,
                          actor_id, actor_username, admin_id, admin_username)
  VALUES ('violation_revoked',
          v_revogadas || ' infracao(oes) revogada(s) automaticamente porque o '
            || v_tipo || ' voltou ao ar',
          'moderation', 'info',
          jsonb_build_object('content_type', v_tipo, 'content_id', OLD.id,
                             'revogadas', v_revogadas, 'pontos', v_pontos,
                             'automatico', true),
          auth.uid(), COALESCE(v_quem, 'anônimo'),
          auth.uid(), COALESCE(v_quem, 'sistema'));

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.revogar_infracao_de_conteudo_restaurado() FROM PUBLIC, anon, authenticated;

-- `AFTER UPDATE OF hidden_at`, e a condicao WHEN e o que torna o gatilho
-- barato: ele só roda quando a coluna realmente foi de "oculto" para "no ar".
DROP TRIGGER IF EXISTS trg_revogar_infracao_restaurada ON public.posts;
CREATE TRIGGER trg_revogar_infracao_restaurada
  AFTER UPDATE OF hidden_at ON public.posts
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL)
  EXECUTE FUNCTION public.revogar_infracao_de_conteudo_restaurado();

DROP TRIGGER IF EXISTS trg_revogar_infracao_restaurada ON public.comments;
CREATE TRIGGER trg_revogar_infracao_restaurada
  AFTER UPDATE OF hidden_at ON public.comments
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL)
  EXECUTE FUNCTION public.revogar_infracao_de_conteudo_restaurado();

DROP TRIGGER IF EXISTS trg_revogar_infracao_restaurada ON public.community_posts;
CREATE TRIGGER trg_revogar_infracao_restaurada
  AFTER UPDATE OF hidden_at ON public.community_posts
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL)
  EXECUTE FUNCTION public.revogar_infracao_de_conteudo_restaurado();

-- ── 4. O poder do admin: remover a suspensão PERDOA os pontos dela ───────────

CREATE OR REPLACE FUNCTION public.lift_suspension(p_user_id uuid, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text; v_estava timestamptz;
  v_revogadas int; v_pontos int;
BEGIN
  PERFORM public.exige_operador_ativo();
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  -- AUTORIZACAO PRIMEIRO (SEC-032).
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;

  SELECT role, username, suspended_until INTO v_target_role, v_target_username, v_estava
    FROM profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN RAISE EXCEPTION 'Usuario nao encontrado'; END IF;

  -- Mesma hierarquia do apply: quem pode suspender pode tirar. `role_rank` e
  -- nao lista literal — lista literal ja causou tres falhas neste projeto.
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot lift suspension of equal or higher role';
  END IF;
  IF v_estava IS NULL OR v_estava <= now() THEN
    RAISE EXCEPTION 'Este usuario nao esta suspenso.';
  END IF;

  UPDATE profiles SET suspended_until = NULL WHERE id = p_user_id;

  -- A PARTE NOVA, e ela e o que faz a remocao valer algo. Sem isto, os pontos
  -- que causaram a suspensao ficavam de pe: a proxima infracao de QUALQUER
  -- tamanho voltava a cruzar o limiar e re-suspendia na hora. O moderador
  -- perdoava e o sistema desfazia o perdao sozinho.
  UPDATE violations
     SET revogada_em     = now(),
         revogada_por    = auth.uid(),
         revogada_motivo = 'suspensao removida por @' || v_caller_username
                           || coalesce(' — ' || p_note, '')
   WHERE user_id = p_user_id AND revogada_em IS NULL;
  GET DIAGNOSTICS v_revogadas = ROW_COUNT;

  SELECT COALESCE(SUM(points), 0) INTO v_pontos
    FROM violations
   WHERE user_id = p_user_id AND revogada_por = auth.uid() AND revogada_em >= now() - interval '1 second';

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_unsuspended',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username
      || coalesce(' — ' || p_note, '')
      || CASE WHEN v_revogadas > 0
              THEN ' (e ' || v_revogadas || ' infração(ões) de ' || v_pontos || ' ponto(s) foram perdoadas)'
              ELSE '' END,
    'security', auth.uid(), v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'era_ate', v_estava, 'nota', p_note,
                       'infracoes_revogadas', v_revogadas, 'pontos_perdoados', v_pontos),
    auth.uid(), v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_unsuspended', 'Suspensão removida',
    '@' || v_target_username || ' teve a suspensão removida por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username));

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'moderation',
    'Sua suspensão foi removida. Você já pode publicar normalmente.');
END;
$function$;

REVOKE ALL ON FUNCTION public.lift_suspension(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lift_suspension(uuid, text) TO authenticated;
