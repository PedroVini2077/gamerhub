-- A escalada passa a contar só infração VIVA, e nasce a inversa automática.
-- Ver `20261008133220_infracao_tem_inversa_teste_de_porta.sql` para o diagnóstico.

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
