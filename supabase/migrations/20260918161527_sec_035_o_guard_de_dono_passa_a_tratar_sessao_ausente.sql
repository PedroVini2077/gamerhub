-- SEC-035 · `[18/09]` `soft_delete_post` e `restore_post` passam a tratar
-- `auth.uid()` NULL. Item do BACKLOG de 11/09, fechado hoje.
--
-- ── Como este item voltou, e o que ele diz sobre mim ──────────────────────
--
-- Ele estava escrito no `BACKLOG.md` desde 11/09, com o mecanismo explicado e a
-- prova em ROLLBACK anexada. **Eu reescrevi as DUAS funcoes hoje, na SEC-032, e
-- nao o li.** O item estava a uma tela de distancia do que eu estava fazendo.
--
-- E e a MESMA armadilha da SEC-030, aplicada horas antes nesta sessao:
--
--   IF auth.uid() <> v_owner AND NOT can_moderate_content(v_owner) THEN RAISE
--
-- Com `auth.uid()` NULL, `NULL <> v_owner` da **NULL**, `NULL AND true` da
-- **NULL**, e um `IF NULL` **nao dispara**. Sem sessao, o guard nao barra.
--
-- ── Por que fechar mesmo NAO sendo explorAvel hoje ────────────────────────
--
-- Medido: `anon` **nao tem** `EXECUTE` em nenhuma das duas, entao ninguem sem
-- sessao alcanca a funcao. A protecao real hoje e o GRANT, nao o codigo.
--
-- E e exatamente por isso que o item nao podia continuar aberto. O §1.3:
-- *"desconfiar de protecao acidental. Se algo so esta seguro por efeito
-- colateral de outra regra, isso nao e protecao — e sorte esperando expirar."*
-- Um `GRANT ... TO anon` escrito por engano um dia, e a porta abre sem que nada
-- no codigo tenha mudado.
--
-- O dono ja decidiu esta classe, na letra: *"independente da brecha, exploravel
-- ou nao, podendo quebrar hj ou nao, era pra ser fechada na hora"*.
--
-- ── O conserto ───────────────────────────────────────────────────────────
--
-- Duas camadas, porque uma so foi o erro do SEC-025:
--   1. `v_eu IS NULL` conferido explicitamente, na primeira linha.
--   2. `IS DISTINCT FROM` no lugar de `<>` — ele devolve `true` com NULL de um
--      lado, entao o guard passa a barrar mesmo se alguem tirar a linha 1.
--
-- A mensagem e a mesma da SEC-032 de proposito: sem sessao, "nao encontrado" e
-- "sem permissao" continuam indistinguiveis.
--
-- ── Provado em ROLLBACK ──────────────────────────────────────────────────
--
--   ATAQUE   chamada SEM `sub` no JWT ......... bloqueado, post intacto
--   LEGITIMO autor apaga o proprio post ....... ok, deleted_at gravado

CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_owner uuid; v_eu uuid := (SELECT auth.uid());
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Post não encontrado ou sem permissão para excluí-lo.';
  END IF;
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL
     OR (v_eu IS DISTINCT FROM v_owner AND NOT can_moderate_content(v_owner)) THEN
    RAISE EXCEPTION 'Post não encontrado ou sem permissão para excluí-lo.';
  END IF;
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id AND deleted_at IS NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.restore_post(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_owner uuid; v_apagado timestamptz; v_eu uuid := (SELECT auth.uid());
BEGIN
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Apenas admins podem restaurar posts'; END IF;
  -- AUTORIZACAO PRIMEIRO (SEC-032).
  IF role_rank((SELECT role FROM profiles WHERE id = v_eu)) < 2 THEN
    RAISE EXCEPTION 'Apenas admins podem restaurar posts';
  END IF;
  SELECT user_id, deleted_at INTO v_owner, v_apagado FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF v_eu IS DISTINCT FROM v_owner AND NOT can_moderate_content(v_owner) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este post';
  END IF;
  IF v_apagado IS NULL THEN
    RAISE EXCEPTION 'Este post não está apagado — não há o que restaurar.';
  END IF;
  UPDATE posts SET deleted_at = null WHERE id = p_post_id AND deleted_at IS NOT NULL;
END;
$fn$;
