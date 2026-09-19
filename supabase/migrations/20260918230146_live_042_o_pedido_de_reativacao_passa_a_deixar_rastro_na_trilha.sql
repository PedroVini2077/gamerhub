-- LIVE-042 · `[18/09]` O pedido de reativacao nao deixava rastro na trilha.
--
-- ── Como isto apareceu: DUAS travas minhas reprovaram juntas ──────────────
--
-- Ao ligar a tela do pedido (LIVE-041), o `npm test` caiu em dois lugares:
--
--   trilhaNaoEhForjavel.test.js .. "o cliente registra action que o banco RECUSA"
--   logMeta.test.js .............. "action passada a logAudit() sem icone"
--
-- Eu tinha posto um `logAudit('live_reactivation_request', ...)` no componente.
-- A trava estava certa em recusar, e pelo motivo que importa: `logAudit` engole
-- o erro DE PROPOSITO (§1.5), entao uma action que o banco recusa vira registro
-- que **nunca acontece** e ninguem descobre.
--
-- ── O buraco de verdade, que a trava expos sem estar procurando ──────────
--
-- Investigando por que o banco recusava, medi as duas RPCs irmas:
--
--   solicitar_revisao_do_proprio_ban ......... grava em admin_logs: SIM
--   solicitar_reativacao_da_propria_live ..... grava em admin_logs: NAO
--
-- A segunda fui EU que escrevi ontem (LIVE-038), dizendo no proprio comentario
-- que ela "espelha o `solicitar_revisao_do_proprio_ban`". Espelhava em tudo
-- menos na trilha.
--
-- Efeito: o dono via a notificacao de admin, mas a trilha de auditoria — o
-- lugar onde ele procura "o que aconteceu neste site" — nao tinha linha
-- nenhuma. Notificacao se marca como lida e some; trilha fica.
--
-- ── Por que no SERVIDOR e nao no cliente ─────────────────────────────────
--
-- O `BANCO.md` ja manda: acao de estado vai pela RPC, e e a RPC que grava em
-- `admin_logs`. Um registro feito pelo cliente pode ser recusado (foi), pode
-- ser pulado (basta nao chamar) e pode ser forjado. Aqui a linha entra na mesma
-- transacao do pedido: ou os dois existem, ou nenhum.
--
-- `category = 'live'` e `severity = 'info'` porque pedir reativacao e o sistema
-- FUNCIONANDO, nao incidente — marcar como alerta seria a mentira que o §0.2
-- (4a regra) proibe, e que ensina a ignorar o canal.
--
-- ── Provado em ROLLBACK ─────────────────────────────────────────────────
--
--   1_deixa_rastro_em_admin_logs ..... OK: 1 linha
--   2_notificacao_continua ........... OK: 1 linha  (nao troquei uma pela outra)

CREATE OR REPLACE FUNCTION public.solicitar_reativacao_da_propria_live(
  p_post_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_eu uuid := auth.uid();
  v_username text; v_dono uuid; v_titulo text;
  v_no_ar boolean; v_apagado timestamptz; v_foi_live boolean;
BEGIN
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Precisa estar autenticado.'; END IF;

  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Escreva pelo menos 10 caracteres explicando o pedido.';
  END IF;
  IF length(p_motivo) > 500 THEN
    RAISE EXCEPTION 'O pedido pode ter no maximo 500 caracteres.';
  END IF;

  SELECT user_id, title, COALESCE(is_live,false), deleted_at, was_live
    INTO v_dono, v_titulo, v_no_ar, v_apagado, v_foi_live
    FROM posts WHERE id = p_post_id;

  -- Mensagem UNIFICADA para "nao existe" e "nao e sua" (SEC-032): sem isso a
  -- funcao vira oraculo de existencia de post.
  IF v_dono IS NULL OR v_dono <> v_eu OR v_apagado IS NOT NULL THEN
    RAISE EXCEPTION 'Live nao encontrada ou nao e sua.';
  END IF;
  IF NOT COALESCE(v_foi_live,false) THEN RAISE EXCEPTION 'Este post nao e uma live.'; END IF;
  IF v_no_ar THEN RAISE EXCEPTION 'Esta live ja esta no ar.'; END IF;

  IF EXISTS (SELECT 1 FROM live_reactivation_requests
              WHERE post_id = p_post_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Ja existe um pedido em analise para esta live.';
  END IF;

  SELECT username INTO v_username FROM profiles WHERE id = v_eu;

  -- `admin_*` sao NOT NULL e recebem o proprio autor. O que separa este caso do
  -- pedido aberto por um admin e a marca `auto_solicitado`.
  INSERT INTO live_reactivation_requests
    (post_id, post_title, admin_id, admin_username, reason, details)
  VALUES (p_post_id, COALESCE(v_titulo,'(sem título)'), v_eu, v_username,
          btrim(p_motivo), 'auto_solicitado');

  -- A TRILHA — o que faltava. Mesma transacao do pedido: ou os dois existem,
  -- ou nenhum. Ver o bloco do topo.
  INSERT INTO admin_logs
    (action, details, category, actor_id, actor_username, severity, metadata,
     admin_id, admin_username)
  VALUES ('live_reactivation_request',
    '@' || v_username || ' pediu reativacao da propria live "'
      || COALESCE(v_titulo,'sem título') || '".',
    'live', v_eu, v_username, 'info',
    jsonb_build_object('post_id', p_post_id, 'auto_solicitado', true),
    v_eu, v_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('live_reactivation_request', 'Pedido de reativacao de live',
    '@' || v_username || ' pediu para reativar a propria live "' || COALESCE(v_titulo,'sem título') || '".',
    'all_admins',
    jsonb_build_object('post_id', p_post_id, 'auto_solicitado', true, 'username', v_username));

  RETURN jsonb_build_object('ok', true);
END;
$fn$;
