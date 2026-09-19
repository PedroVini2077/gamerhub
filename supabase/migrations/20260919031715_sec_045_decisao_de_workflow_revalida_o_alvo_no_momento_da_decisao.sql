-- SEC-045 · `[19/09]` Decisao administrativa confiava em snapshot historico.
-- Achados N25, N26, N27, N38 (e o N39, que e consequencia deles).
--
-- ══ A CAUSA-RAIZ, irma da SEC-044 ═══════════════════════════════════════
--
-- A SEC-044 vinculou a decisao a GERACAO do estado. Esta trata o outro lado:
-- **o alvo continua apto AGORA?**
--
--   N25  candidato elegivel -> indicado -> BANIDO -> indicacao aprovada
--   N27  candidato em trial -> BANIDO   -> trial confirmado
--   N26  alvo era `admin`   -> virou `user` por fora -> demotion aprovada
--
-- O projeto ja tinha o principio certo em OUTRO lugar: o N40 (perder privilegio
-- no meio do fluxo) foi PASS porque a autorizacao do CHAMADOR e recalculada na
-- decisao. Faltava fazer o mesmo com o ALVO.
--
--   autorizacao do chamador ... recalculada  (N40 = PASS)
--   estado do alvo ............ snapshot     (N25/N26/N27 = falha)
--
-- ══ N25 e N27 QUASE VIRARAM PASS SEM TESTE ═════════════════════════════
--
-- Na 1a tentativa a nomeacao nem chegou a ser criada (o candidato nao tinha
-- elegibilidade), e os "Indicacao nao encontrada" seguintes eram artefato do
-- meu teste — nao prova de protecao. O achado e sobre a DECISAO, entao a linha
-- passou a ser inserida direto e as funcoes de decisao foram exercidas de
-- verdade. **Ausencia de teste nao e PASS.**
--
-- ══ SO NO CAMINHO QUE AVANCA O ESTADO ══════════════════════════════════
--
-- `reject`, `revert` e `extend` NAO revalidam de proposito: negar a indicacao
-- de alguem que foi banido no meio precisa continuar possivel, senao a fila
-- trava com itens que ninguem consegue encerrar.
--
-- ══ PROVADO EM ROLLBACK — 9 asercoes, ataque E regressao ═══════════════
--   N25 aprovar candidato BANIDO ............ recusado
--   N26 decidir demotion com cargo mudado ... recusado, dizendo de->para
--   N27 confirmar trial de BANIDO ........... recusado
--   N27 EFEITO: o cargo continuou `user` .... OK
--   REG aprovar candidato SAUDAVEL .......... passou
--   REG confirmar trial SAUDAVEL ............ passou
--   REG EFEITO: virou `admin` de verdade .... OK
--   REG demotion legitima ................... passou
--   REG EFEITO: rebaixou de verdade ......... OK

CREATE OR REPLACE FUNCTION public.exige_alvo_apto(p_user_id uuid, p_cargo_esperado text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_role text; v_banido boolean; v_susp timestamptz;
BEGIN
  SELECT role, COALESCE(banned,false), suspended_until INTO v_role, v_banido, v_susp
    FROM profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Usuario nao encontrado.'; END IF;
  IF v_banido THEN
    RAISE EXCEPTION 'O alvo esta BANIDO agora — a decisao foi criada sobre outro estado.';
  END IF;
  IF v_susp IS NOT NULL AND v_susp > now() THEN
    RAISE EXCEPTION 'O alvo esta SUSPENSO ate % — a decisao foi criada sobre outro estado.',
      to_char(v_susp,'DD/MM/YYYY HH24:MI');
  END IF;
  IF p_cargo_esperado IS NOT NULL AND v_role IS DISTINCT FROM p_cargo_esperado THEN
    RAISE EXCEPTION 'O cargo do alvo mudou de % para % depois que a solicitacao foi criada. Decida sobre o estado atual.',
      p_cargo_esperado, v_role;
  END IF;
END;
$fn$;

COMMENT ON FUNCTION public.exige_alvo_apto(uuid,text) IS
  'SEC-045: o ALVO de um workflow continua apto AGORA? Irma do exige_operador_ativo, que cuida do CHAMADOR. Chamada so no caminho que AVANCA o estado — rejeitar tem que continuar possivel.';

REVOKE EXECUTE ON FUNCTION public.exige_alvo_apto(uuid,text) FROM PUBLIC, anon, authenticated;

DO $edit$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.decide_role_demotion(uuid,text,text)'::regprocedure);
  IF d !~ 'Solicitação já foi analisada' THEN RAISE EXCEPTION 'ancora do decide_role_demotion sumiu'; END IF;
  EXECUTE replace(d,
    E'if v_req.status <> ''pending'' then raise exception ''Solicitação já foi analisada''; end if;',
    E'if v_req.status <> ''pending'' then raise exception ''Solicitação já foi analisada''; end if;\n'
    '  if p_decision = ''approve'' then perform public.exige_alvo_apto(v_req.target_id, v_req.previous_role); end if;');

  d := pg_get_functiondef('public.review_staff_nomination(uuid,text,text,integer)'::regprocedure);
  IF d !~ 'Indicação já foi analisada' THEN RAISE EXCEPTION 'ancora do review_staff_nomination sumiu'; END IF;
  EXECUTE replace(d,
    E'if v_nom.status <> ''pending'' then raise exception ''Indicação já foi analisada''; end if;',
    E'if v_nom.status <> ''pending'' then raise exception ''Indicação já foi analisada''; end if;\n'
    '  if p_decision = ''approve'' then perform public.exige_alvo_apto(v_nom.candidate_id); end if;');

  d := pg_get_functiondef('public.decide_staff_trial(uuid,text,text,integer)'::regprocedure);
  IF d !~ 'não está em período de avaliação' THEN RAISE EXCEPTION 'ancora do decide_staff_trial sumiu'; END IF;
  EXECUTE replace(d,
    E'if v_nom.status <> ''trial_active'' then raise exception ''Esta indicação não está em período de avaliação''; end if;',
    E'if v_nom.status <> ''trial_active'' then raise exception ''Esta indicação não está em período de avaliação''; end if;\n'
    '  if p_decision = ''confirm'' then perform public.exige_alvo_apto(v_nom.candidate_id); end if;');
END $edit$;
