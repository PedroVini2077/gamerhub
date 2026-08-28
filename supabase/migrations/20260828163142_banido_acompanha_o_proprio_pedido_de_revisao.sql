-- Quem recorreu precisa poder ACOMPANHAR o caso.
--
-- O formulário de recurso entrou em 28/08, mas parava ali: a pessoa enviava e
-- nunca mais sabia de nada. Pior, como o dono apontou: se o admin decidir
-- enquanto ela não está online, uma notificação em tempo real passa batido.
--
-- A resposta não é notificação nem email: é ESTADO CONSULTÁVEL. O pedido já
-- vive em `unban_requests`; basta a própria pessoa poder lê-lo. Estado no banco
-- não expira, não depende de a pessoa estar online, e não precisa de um segundo
-- canal para manter sincronizado.
--
-- E o caso de "foi desbanida sem estar online" se resolve sozinho: ela entra e
-- o site funciona. O acompanhamento existe para os outros dois desfechos —
-- ainda em análise, ou negado com um motivo que ela merece ler.
--
-- Devolve só o pedido do BANIMENTO ATUAL (corte por `banned_at`), pelo mesmo
-- motivo do limite de um pedido por ban: histórico de banimentos antigos não é
-- assunto desta tela.
CREATE OR REPLACE FUNCTION public.meu_pedido_de_revisao()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_id uuid := auth.uid();
  v_banido_em timestamptz;
  r record;
BEGIN
  IF v_id IS NULL THEN RETURN jsonb_build_object('existe', false); END IF;

  SELECT banned_at INTO v_banido_em FROM profiles WHERE id = v_id;

  SELECT status, reason, review_note, created_at, reviewed_at INTO r
    FROM unban_requests
   WHERE target_user_id = v_id
     AND created_at >= COALESCE(v_banido_em, '-infinity'::timestamptz)
   ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('existe', false); END IF;

  RETURN jsonb_build_object(
    'existe', true, 'status', r.status, 'motivo', r.reason,
    'resposta', r.review_note, 'enviado_em', r.created_at, 'respondido_em', r.reviewed_at);
END $fn$;

-- Só a própria pessoa, e só autenticada. `anon` não lê pedido de ninguém.
REVOKE ALL ON FUNCTION public.meu_pedido_de_revisao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meu_pedido_de_revisao() TO authenticated;