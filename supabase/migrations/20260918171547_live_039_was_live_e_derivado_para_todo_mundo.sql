-- LIVE-039 · `[18/09]` `was_live` passa a ser derivado para TODO MUNDO, e nao
-- so para usuario comum. Bug que EU introduzi hoje, achado por teste meu.
--
-- ── O que quebrou, e quando ──────────────────────────────────────────────
--
-- A SEC-027 fez duas coisas no mesmo dia:
--   1. tirou `was_live` do corpo que o `createPost` manda;
--   2. pos a DERIVACAO dele dentro do ramo `v_comum` do guard.
--
-- Para usuario comum funciona: o guard deriva. Para quem tem
-- `role_rank >= 2` o guard **retorna antes**, e como o cliente nao manda mais
-- nada, `was_live` ficava no DEFAULT — `false`.
--
-- **Resultado: toda live criada por admin, super admin ou owner nascia com
-- `was_live = false`.**
--
-- ── O estrago, que nao e o XP ────────────────────────────────────────────
--
-- O XP sobreviveu por acidente: desde a LIVE-036 ele conta de
-- `lives_realizadas`, populada pela transicao `is_live` true->false, sem olhar
-- `was_live`.
--
-- Quem quebra e a LIMPEZA. O cron de 5 em 5 minutos apaga assim:
--
--   DELETE FROM posts WHERE was_live = true AND is_live = false AND ...
--
-- Com `was_live = false`, a live encerrada de um admin **nunca seria
-- apagada**. Ela ficaria no feed para sempre, com um embed morto — exatamente
-- o problema que aquele cron existe para evitar. E acumulando.
--
-- ── A correcao, e a licao sobre ONDE a regra mora ────────────────────────
--
-- DERIVACAO e PINAGEM sao coisas diferentes e estavam no mesmo `if`:
--
--   derivar `was_live` de `is_live`  -> vale para TODO MUNDO. Ninguem, em
--                                       cargo nenhum, tem motivo para declarar
--                                       este campo a mao.
--   pinar `hidden_at`, `deleted_at`  -> vale so para usuario COMUM, porque a
--   e o bloqueio de reativacao          moderacao precisa escrever essas.
--
-- Agora a derivacao roda antes do `RETURN NEW` do caminho privilegiado.
--
-- ── Provado em ROLLBACK, os dois papeis ─────────────────────────────────
--
--   live criada pelo OWNER ............... was_live = true   (era false)
--   live criada pelo usuario COMUM ....... was_live = true
--   INSERT forjando was_live sem live .... fechado
--   sessao do owner registrada ........... 1 linha
--   o cron passa a enxergar para limpar .. sim

CREATE OR REPLACE FUNCTION public.guard_post_privileged_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE v_comum boolean;
BEGIN
  -- ── DERIVACAO — vale para TODO MUNDO ──────────────────────────────────
  -- `was_live` nunca vem do cliente, em cargo nenhum: ele e consequencia de
  -- `is_live`. Monotonico, porque uma live que aconteceu nao desacontece.
  IF TG_OP = 'INSERT' THEN
    NEW.was_live := COALESCE(NEW.is_live, false);
  ELSE
    NEW.was_live := OLD.was_live OR COALESCE(NEW.is_live, false);
  END IF;

  v_comum := current_user IN ('authenticated','anon')
         AND role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2;
  IF NOT v_comum THEN RETURN NEW; END IF;

  -- ── PINAGEM — so para usuario comum ───────────────────────────────────
  -- Daqui para baixo e o que a EQUIPE precisa poder escrever: `hidden_at` e
  -- `deleted_at` sao a moderacao, e reativar e ato de equipe.
  IF TG_OP = 'INSERT' THEN
    NEW.expires_at    := NULL;
    NEW.live_ended_at := NULL;
    NEW.created_at    := now();
    NEW.deleted_at    := NULL;
    RETURN NEW;
  END IF;

  NEW.user_id         := OLD.user_id;
  NEW.hidden_at       := OLD.hidden_at;
  NEW.deleted_at      := OLD.deleted_at;
  NEW.created_at      := OLD.created_at;
  NEW.expires_at      := OLD.expires_at;
  NEW.live_kind       := OLD.live_kind;
  NEW.live_kind_label := OLD.live_kind_label;
  NEW.live_ended_at   := OLD.live_ended_at;
  NEW.live_started_at := OLD.live_started_at;

  -- Reativar e ato de equipe (LIVE-038). O autor ENCERRA; por de volta no ar
  -- passa pelo pedido.
  IF COALESCE(NEW.is_live,false) AND NOT COALESCE(OLD.is_live,false) THEN
    NEW.is_live := OLD.is_live;
  END IF;
  RETURN NEW;
END;
$fn$;

-- Conserta as lives de equipe que ja nasceram com o campo errado hoje.
UPDATE public.posts SET was_live = true
 WHERE NOT was_live AND (is_live OR live_started_at IS NOT NULL OR live_ended_at IS NOT NULL);
