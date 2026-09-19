-- LIVE-052 · `[19/09]` A moderacao perdia o alcance 15 minutos depois da live.
--
-- ── O que foi medido, e e o motivo desta migration existir ──────────────
--
-- Varredura de classe do LIVE-051, contra a producao de hoje:
--
--   sessoes em `lives_realizadas` ................. 10
--   com o post JA APAGADO pelo cron ............... 10
--   VALIDAS e fora do alcance da moderacao .........  8
--
-- A invalidacao do XP era um trigger em `posts`. O cron apaga o post 15 min
-- depois que a live encerra. Sem post nao ha `UPDATE` para disparar o trigger —
-- entao o XP daquela live virava PERMANENTE, e nem o fundador desfazia.
--
-- E a regra da INVERSA do BANCO.md pelo avesso: a ida e a volta existiam, mas
-- as duas EXPIRAVAM junto com o post. O LIVE-036 desacoplou o registro do post
-- de proposito, para o XP sobreviver ao cron; o efeito colateral e que a
-- moderacao nao sobreviveu junto.
--
-- ── Por que RPC, e nao policy ──────────────────────────────────────────
--
-- `lives_realizadas` tem RLS ligada, ZERO policies e ZERO grants: nem `anon`
-- nem `authenticated` alcancam a tabela. Abrir a tabela para a equipe daria
-- leitura e escrita amplas a todo `authenticated` com cargo — o oposto da
-- regua de papeis. Tres RPCs `SECURITY DEFINER` mantem a tabela fechada.
--
-- ── O prefixo do motivo NAO e cosmetico ────────────────────────────────
--
-- `invalidar_lives_do_post_moderado` limpa, ao restaurar o post, so as linhas
-- com `invalidada_motivo = 'ocultada pela moderacao'`. Um ato MANUAL precisa
-- de motivo distinto, senao restaurar o post desfaria por baixo uma decisao
-- que uma pessoa tomou. Por isso `'invalidada pela equipe: ' || motivo`.
--
-- E por isso a `revalidar_live_realizada` RECUSA desfazer invalidacao
-- automatica: a volta dela e restaurar o post. Duas portas para o mesmo estado
-- divergem (§4).
--
-- ── Provado em ROLLBACK com papel `authenticated` real: 14 de 14 ───────
--
--   comum nao LISTA / nao INVALIDA ............. bloqueado
--   comum com uuid inexistente ................. nega ANTES de procurar
--   admin lista ................................ 15 sessoes
--   motivo com 2 caracteres / NULL ............. recusado
--   admin x sessao de outro ADMIN .............. hierarquia barrou
--   admin invalida sessao de comum ............. passou
--   invalidar duas vezes ....................... recusado
--   revalidar uma AUTOMATICA ................... manda restaurar o post
--   INVERSA: revalidar manual .................. voltou a valer
--   trilha gravou as 2 acoes ................... sim
--   o autor foi avisado nas 2 .................. sim
--
-- E o EFEITO medido em producao, que e o que interessa:
--   XP `lives` do autor ... 1 -> 0 (invalidar) -> 1 (inversa)
--
-- A terceira linha e a trava `autorizacaoAntesDeExistencia`: `SECURITY
-- DEFINER` que procura o alvo antes de checar quem chama vira oraculo de
-- existencia. Aqui a autorizacao vem primeiro, sempre.

CREATE OR REPLACE FUNCTION public.listar_lives_realizadas(p_limite int DEFAULT 30)
RETURNS TABLE (id uuid, user_id uuid, username text, titulo text, live_kind text,
               iniciada_em timestamptz, encerrada_em timestamptz,
               invalidada_em timestamptz, invalidada_motivo text,
               post_existe boolean, posso_moderar boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public.exige_operador_ativo();
  -- AUTORIZACAO PRIMEIRO (SEC-032).
  IF role_rank((SELECT role FROM profiles WHERE profiles.id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Access denied: staff required';
  END IF;
  -- FAIXA, nao so tipo. `p_limite` vem do cliente, e a REST API aceita 999999.
  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 200 THEN
    RAISE EXCEPTION 'Limite deve ser de 1 a 200.';
  END IF;

  RETURN QUERY
  SELECT lr.id, lr.user_id, pr.username, lr.titulo, lr.live_kind,
         lr.iniciada_em, lr.encerrada_em, lr.invalidada_em, lr.invalidada_motivo,
         -- A tela precisa dizer que o post ja nao existe: e a explicacao de por
         -- que esta RPC e o unico caminho para aquela sessao.
         EXISTS (SELECT 1 FROM posts po WHERE po.id = lr.post_id),
         -- Quem NAO pode moderar aquele autor ve a linha sem botao, em vez de
         -- clicar e tomar erro. O banco continua decidindo no ato.
         can_moderate_content(lr.user_id)
    FROM lives_realizadas lr
    LEFT JOIN profiles pr ON pr.id = lr.user_id
   ORDER BY lr.encerrada_em DESC
   LIMIT p_limite;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invalidar_live_realizada(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_quem text; v_autor uuid; v_autor_nome text; v_titulo text; v_ja timestamptz;
BEGIN
  PERFORM public.exige_operador_ativo();
  SELECT username INTO v_quem FROM profiles WHERE profiles.id = auth.uid();
  -- AUTORIZACAO PRIMEIRO (SEC-032): sem isto a funcao vira oraculo de existencia.
  IF role_rank((SELECT role FROM profiles WHERE profiles.id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Access denied: staff required';
  END IF;
  -- FAIXA (BANCO.md). `NULL < 3` e NULL e o IF nao dispara — por isso IS NULL
  -- explicito. A mensagem chega no toast, entao ela e em portugues.
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 3 OR length(p_motivo) > 200 THEN
    RAISE EXCEPTION 'O motivo precisa ter de 3 a 200 caracteres.';
  END IF;

  SELECT lr.user_id, lr.titulo, lr.invalidada_em INTO v_autor, v_titulo, v_ja
    FROM lives_realizadas lr WHERE lr.id = p_id;
  IF v_autor IS NULL THEN RAISE EXCEPTION 'Sessao de live nao encontrada.'; END IF;
  -- Hierarquia por funcao, nunca lista literal — lista literal ja falhou 3x.
  IF NOT can_moderate_content(v_autor) THEN
    RAISE EXCEPTION 'Access denied: cannot moderate equal or higher role';
  END IF;
  IF v_ja IS NOT NULL THEN RAISE EXCEPTION 'Esta live ja esta invalidada.'; END IF;

  SELECT username INTO v_autor_nome FROM profiles WHERE profiles.id = v_autor;

  -- O prefixo separa o MANUAL do automatico: o trigger de restaurar o post
  -- limpa so `= 'ocultada pela moderacao'`, entao um ato de pessoa nao e
  -- desfeito por baixo quando alguem restaura o post.
  UPDATE lives_realizadas
     SET invalidada_em = now(), invalidada_motivo = 'invalidada pela equipe: ' || btrim(p_motivo)
   WHERE lives_realizadas.id = p_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('live_xp_invalidado',
    'XP da live "' || coalesce(v_titulo,'(sem título)') || '" de @' || coalesce(v_autor_nome,'?')
      || ' invalidado por @' || v_quem || ' — ' || btrim(p_motivo),
    'moderation', auth.uid(), v_quem, 'warning',
    jsonb_build_object('live_id', p_id, 'target_id', v_autor, 'motivo', btrim(p_motivo)),
    auth.uid(), v_quem);

  -- O alvo precisa saber (BANCO.md): acao de moderacao que a pessoa descobre
  -- sozinha, porque o XP caiu, e indistinguivel de bug do lado dela.
  INSERT INTO notifications (user_id, type, message)
  VALUES (v_autor, 'moderation',
    'O XP da sua live "' || coalesce(v_titulo,'(sem título)') || '" foi removido pela equipe — ' || btrim(p_motivo));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.revalidar_live_realizada(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_quem text; v_autor uuid; v_autor_nome text; v_titulo text; v_motivo text;
BEGIN
  PERFORM public.exige_operador_ativo();
  SELECT username INTO v_quem FROM profiles WHERE profiles.id = auth.uid();
  IF role_rank((SELECT role FROM profiles WHERE profiles.id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Access denied: staff required';
  END IF;

  SELECT lr.user_id, lr.titulo, lr.invalidada_motivo INTO v_autor, v_titulo, v_motivo
    FROM lives_realizadas lr WHERE lr.id = p_id;
  IF v_autor IS NULL THEN RAISE EXCEPTION 'Sessao de live nao encontrada.'; END IF;
  IF NOT can_moderate_content(v_autor) THEN
    RAISE EXCEPTION 'Access denied: cannot moderate equal or higher role';
  END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Esta live nao esta invalidada.'; END IF;
  -- A volta de uma invalidacao AUTOMATICA e restaurar o post, nao esta RPC.
  -- Duas portas para o mesmo estado divergem (§4), e a automatica tem trigger
  -- proprio que ja sabe quando devolver.
  IF v_motivo NOT LIKE 'invalidada pela equipe: %' THEN
    RAISE EXCEPTION 'Esta live foi invalidada automaticamente (%). Restaure o post para devolver o XP.', v_motivo;
  END IF;

  SELECT username INTO v_autor_nome FROM profiles WHERE profiles.id = v_autor;
  UPDATE lives_realizadas SET invalidada_em = NULL, invalidada_motivo = NULL
   WHERE lives_realizadas.id = p_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('live_xp_revalidado',
    'XP da live "' || coalesce(v_titulo,'(sem título)') || '" de @' || coalesce(v_autor_nome,'?')
      || ' devolvido por @' || v_quem,
    'moderation', auth.uid(), v_quem, 'info',
    jsonb_build_object('live_id', p_id, 'target_id', v_autor, 'era', v_motivo),
    auth.uid(), v_quem);

  INSERT INTO notifications (user_id, type, message)
  VALUES (v_autor, 'moderation',
    'O XP da sua live "' || coalesce(v_titulo,'(sem título)') || '" foi devolvido pela equipe.');
END;
$fn$;

-- Funcao administrativa: fechada para PUBLIC/anon, aberta para `authenticated`
-- (que e onde a equipe vive), com a checagem interna por `auth.uid()` por cima.
REVOKE EXECUTE ON FUNCTION public.listar_lives_realizadas(int)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.invalidar_live_realizada(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revalidar_live_realizada(uuid)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.listar_lives_realizadas(int)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.invalidar_live_realizada(uuid,text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.revalidar_live_realizada(uuid)      TO authenticated;
