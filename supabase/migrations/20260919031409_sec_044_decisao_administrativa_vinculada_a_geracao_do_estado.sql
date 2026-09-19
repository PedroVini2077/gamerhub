-- SEC-044 · `[19/09]` Um pedido de unban criado para o BAN A removia o BAN B.
-- Achados N41, N32, N33/N42 e N34.
--
-- ══ A CAUSA-RAIZ: a decisao nao estava vinculada a GERACAO do estado ═════
--
-- `unban_requests` guardava QUEM e POR QUE, nunca SOBRE QUAL BANIMENTO:
--
--   1. BAN A ("Spam / flood")                -> pedido de revisao criado
--   2. o ban A e resolvido por fora           -> unban
--   3. BAN B ("Trapaça / exploits")           -> infracao NOVA e mais grave
--   4. alguem aprova o pedido do passo 1      -> **o BAN B some**
--
-- Medido, com o valor relido: "REMOVIDO — pedido velho matou ban novo".
--
-- A assimetria que revela o bug: `unban_user` JA conferia
-- `IF v_target_banned IS NOT TRUE THEN RAISE`. `approve_unban_request` nao
-- conferia nada. Duas portas para o mesmo ato, uma trancada.
--
-- ══ POR QUE A GERACAO E `ban_count` E NAO `banned_at` ═══════════════════
--
-- Minha 1a versao usou `banned_at` e o teste REPROVOU. O motivo vale mais que
-- o conserto:
--
--     `now()` em PostgreSQL e a hora da TRANSACAO, nao do comando.
--
-- Ban A e Ban B na mesma transacao receberam `banned_at` IDENTICO, e a guarda
-- comparou dois valores iguais. Ela teria ficado no codigo parecendo proteger.
--
-- `ban_count` e incrementado por `ban_user` E por `apply_mod_auto_ban`. Ele
-- muda por BANIMENTO, nao por relogio.
--
-- ══ A GERACAO E DERIVADA, NAO DECLARADA ════════════════════════════════
--
-- Trigger BEFORE INSERT, mesmo principio do `was_live`: o cliente nao escolhe
-- a geracao do proprio pedido. Bonus: os DOIS caminhos de criacao
-- (`request_unban` e `solicitar_revisao_do_proprio_ban`) ficam cobertos sem eu
-- recopiar corpo nenhum.
--
-- ══ N33/N42 — a REGRA DE PRODUTO, escrita para ser contestada ══════════
--
-- Medido: suspenso 10 dias -> banido -> desbanido. Resultado: `banned=false` e
-- `suspended_until` ainda no futuro. O admin ve "desbanido", a pessoa continua
-- sem publicar, e ninguem sabe por que. §1.5 exato.
--
-- **A regra:** o ban ABSORVE a suspensao, e o unban limpa as duas. Quem quiser
-- manter a suspensao reaplica — ato visivel, com log e hierarquia. A
-- alternativa (restaurar o saldo) e defensavel; escolhi limpar porque o modo de
-- falhar do silencio e pior.
--
-- ══ N34 — a corrida deixou de ser hipotese ═════════════════════════════
--
-- `request_unban` fazia `IF EXISTS ... INSERT`, sem nada atomico no meio. Nao
-- precisei reproduzir a concorrencia: um indice unico parcial torna dois
-- pendentes para o mesmo alvo IMPOSSIVEIS — trava de 1a forca.
--
-- ══ PROVADO EM ROLLBACK — 7 asercoes ═══════════════════════════════════
--   N41 pedido velho x ban novo ......... recusado, citando as geracoes
--   N41 EFEITO: o ban B sobreviveu ...... OK
--   N32 alvo ja nao esta banido ......... recusado
--   N34 segundo pedido pendente ......... barrado pelo indice
--   N33 unban limpa a suspensao ......... OK
--   REG fluxo legitimo ainda desbana .... OK
--   REG EFEITO: desbaniu mesmo .......... OK

ALTER TABLE public.unban_requests ADD COLUMN IF NOT EXISTS ban_geracao integer;

COMMENT ON COLUMN public.unban_requests.ban_geracao IS
  'SEC-044: o `profiles.ban_count` do alvo quando o pedido nasceu. Aprovar exige que ele nao tenha mudado. Derivado por trigger, nunca declarado pelo cliente.';

CREATE OR REPLACE FUNCTION public.marcar_geracao_do_ban()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  NEW.ban_geracao := (SELECT COALESCE(ban_count,0) FROM profiles WHERE id = NEW.target_user_id);
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.marcar_geracao_do_ban() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_geracao_do_ban ON public.unban_requests;
CREATE TRIGGER trg_geracao_do_ban BEFORE INSERT ON public.unban_requests
  FOR EACH ROW EXECUTE FUNCTION public.marcar_geracao_do_ban();

CREATE UNIQUE INDEX IF NOT EXISTS unban_requests_um_pendente_por_alvo
  ON public.unban_requests (target_user_id) WHERE status = 'pending';

DO $edit$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.approve_unban_request(uuid)'::regprocedure);
  IF d !~ 'Request not found or already reviewed' THEN
    RAISE EXCEPTION 'A ancora sumiu do approve_unban_request — nao injetei nada.';
  END IF;
  d := replace(d,
    E'IF NOT FOUND THEN RAISE EXCEPTION ''Request not found or already reviewed''; END IF;',
    E'IF NOT FOUND THEN RAISE EXCEPTION ''Request not found or already reviewed''; END IF;\n\n'
    '  IF NOT (SELECT COALESCE(banned,false) FROM profiles WHERE id = v_req.target_user_id) THEN\n'
    '    RAISE EXCEPTION ''Este usuario ja nao esta banido — o pedido ficou para tras.'';\n'
    '  END IF;\n'
    '  IF (SELECT COALESCE(ban_count,0) FROM profiles WHERE id = v_req.target_user_id)\n'
    '     IS DISTINCT FROM v_req.ban_geracao THEN\n'
    '    RAISE EXCEPTION ''Este pedido e de um banimento ANTERIOR (geracao %, atual %). O usuario foi banido de novo depois dele.'',\n'
    '      v_req.ban_geracao, (SELECT COALESCE(ban_count,0) FROM profiles WHERE id = v_req.target_user_id);\n'
    '  END IF;\n');
  EXECUTE d;

  FOR d IN SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('unban_user','approve_unban_request')
  LOOP
    IF d !~ 'SET banned = false, ban_reason = NULL, ban_details = NULL,' THEN
      RAISE EXCEPTION 'A ancora do UPDATE de unban mudou — nao injetei a limpeza da suspensao.';
    END IF;
    EXECUTE replace(d,
      'SET banned = false, ban_reason = NULL, ban_details = NULL,',
      'SET banned = false, ban_reason = NULL, ban_details = NULL, suspended_until = NULL,');
  END LOOP;
END $edit$;
