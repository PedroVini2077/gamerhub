-- Quem é banido passa a ter como recorrer.
--
-- Até 28/08/2026 a `BannedScreen` mostrava o motivo e deslogava em 6 segundos:
-- sem botão, sem formulário, sem contato. E `request_unban` exigia cargo de
-- staff, ou seja, **só um admin abria o pedido em nome da pessoa**. Coerente com
-- a hierarquia, e ainda assim uma porta que só abre de um lado: quem foi banido
-- por engano — e engano acontece, ainda mais com moderação automática — não
-- tinha a quem recorrer, nem sabia a quem.

-- ---------------------------------------------------------------------------
-- 1. O pedido feito pela própria pessoa.
--
-- Limite de UM por banimento, e o corte é `profiles.banned_at`: pedidos criados
-- antes do ban atual não contam, então quem foi banido, recorreu, foi desbanido
-- e depois banido de novo tem direito a recorrer outra vez. Contar "pendentes"
-- não serviria — depois de uma negativa a pessoa poderia insistir para sempre.
--
-- A faixa do texto é explícita (§5, "toda entrada de RPC precisa de FAIXA"):
-- mínimo de 20 caracteres para não virar um "pf" que ninguém consegue avaliar,
-- máximo de 1000 para não virar vetor de entulho na tela do painel.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.solicitar_revisao_do_proprio_ban(p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_id uuid := auth.uid();
  v_username text;
  v_banido boolean;
  v_banido_em timestamptz;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'Precisa estar autenticado.'; END IF;

  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 20 THEN
    RAISE EXCEPTION 'Escreva pelo menos 20 caracteres explicando seu pedido.';
  END IF;
  IF length(p_motivo) > 1000 THEN
    RAISE EXCEPTION 'O pedido pode ter no maximo 1000 caracteres.';
  END IF;

  SELECT username, banned, banned_at INTO v_username, v_banido, v_banido_em
    FROM profiles WHERE id = v_id;

  IF NOT COALESCE(v_banido, false) THEN
    RAISE EXCEPTION 'Sua conta nao esta banida.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unban_requests
     WHERE target_user_id = v_id
       AND created_at >= COALESCE(v_banido_em, '-infinity'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'Voce ja enviou um pedido de revisao para este banimento.';
  END IF;

  -- `requesting_admin_*` são NOT NULL e recebem a própria pessoa. O que separa
  -- este caso do pedido aberto por um admin é a flag `auto_solicitado` no log e
  -- na notificação — sem ela, o painel mostraria "@joao pediu o desbanimento de
  -- @joao" sem explicar por que o solicitante é o próprio alvo.
  INSERT INTO unban_requests
    (target_user_id, target_username, requesting_admin_id, requesting_admin_username, reason)
  VALUES (v_id, v_username, v_id, v_username, p_motivo);

  INSERT INTO admin_logs
    (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_unban_requested',
    '@' || v_username || ' pediu revisao do proprio banimento.',
    'security', v_id, v_username, 'info',
    jsonb_build_object('target_username', v_username, 'auto_solicitado', true),
    NULL, 'sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_request', 'Pedido de revisao de banimento',
    '@' || v_username || ' pediu revisao do proprio banimento.',
    'super_admin',
    jsonb_build_object('target_username', v_username, 'auto_solicitado', true));

  RETURN jsonb_build_object('ok', true);
END $fn$;

REVOKE ALL ON FUNCTION public.solicitar_revisao_do_proprio_ban(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_revisao_do_proprio_ban(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. BUG DE HIERARQUIA, achado ao ler a função ao lado.
--
-- `request_unban` checava `v_caller_role NOT IN ('admin')` — lista literal com
-- UM cargo. Efeito: `super_admin` e `owner`, que estão ACIMA de admin, não
-- conseguiam abrir pedido de desbanimento. O fundador do site era barrado de
-- uma ação que o subordinado dele fazia.
--
-- É a quarta vez que uma lista de papéis escrita à mão morde este projeto
-- (`CLAUDE.md` §1.3: "hierarquia nunca se escreve à mão"). Passa a usar
-- `is_staff()`, que é a fonte única.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_unban(p_user_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_username text;
  v_target_username text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Access denied: staff only';
  END IF;
  SELECT username INTO v_caller_username FROM profiles WHERE id = v_caller_id;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN
    RAISE EXCEPTION 'User is not banned';
  END IF;
  IF EXISTS (SELECT 1 FROM unban_requests WHERE target_user_id = p_user_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Already has a pending request';
  END IF;

  INSERT INTO unban_requests (target_user_id, target_username, requesting_admin_id, requesting_admin_username, reason)
  VALUES (p_user_id, v_target_username, v_caller_id, v_caller_username, p_reason);

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_requested',
    'Admin @' || v_caller_username || ' solicitou desbanimento de @' || v_target_username ||
      '. Motivo: ' || p_reason,
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_target_username, 'reason', p_reason),
    v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_request', 'Solicitação de desbanimento',
    'Admin @' || v_caller_username || ' pediu o desbanimento de @' || v_target_username,
    'super_admin',
    jsonb_build_object('target_username', v_target_username, 'admin_username', v_caller_username));
END $fn$;