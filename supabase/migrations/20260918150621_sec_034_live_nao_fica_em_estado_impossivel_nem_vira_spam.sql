-- SEC-034 · `[18/09]` A live para de aceitar estado logicamente impossivel, e
-- de virar canhao de notificacao. Achado N7 da auditoria externa.
--
-- ── Parte 1: o estado impossivel ──────────────────────────────────────────
--
-- O `set_live_ended_at` gravava `live_ended_at` no encerramento e **nunca o
-- limpava** na reativacao. Depois de um ciclo encerrar -> reativar, o post
-- ficava assim:
--
--   is_live       = true      <- esta no ar
--   live_ended_at = 12:46     <- e terminou as 12:46
--
-- As duas coisas nao podem ser verdade juntas. Nada estourava: o card mostra
-- "AO VIVO" e o selo de encerramento le o mesmo campo, entao a tela passa a
-- depender de qual componente olha primeiro.
--
-- ── Parte 2: apagar o post NAO encerrava a live ───────────────────────────
--
-- Isto o relatorio nao pediu, e apareceu ao investigar a parte 1. O
-- `fetchActiveLives` filtra `is_live = true` e **nao filtrava `deleted_at`**.
-- Para quem nao e da equipe a RLS esconde; para admin (role_rank >= 2) a
-- policy `posts_select` libera conteudo apagado — entao **uma live apagada
-- continuava listada como "AO VIVO" no painel da equipe**.
--
-- E a regra do BANCO.md §"Toda acao de estado precisa da INVERSA e da LIMPEZA"
-- e explicita sobre isso: ao apagar conteudo, perguntar *"quem passa a apontar
-- para o nada?"*. Apagar o post encerra a live, no banco, para todo caminho de
-- apagamento — nao so o que o frontend usa hoje.
--
-- ── Parte 3: o spam, e a 4a regra do §0.2 ─────────────────────────────────
--
-- Cada `false -> true` disparava `live_reactivated` para TODOS os admins, sem
-- teto. Um usuario comum alterna `is_live` no proprio post e enche o painel da
-- equipe. Medido antes desta migration: **36 das 116** notificacoes de admin
-- eram de live (31%), 12 delas `live_reactivated` — geradas por um teste
-- alternando o mesmo post.
--
-- A 4a regra do §0.2 pergunta: *"quem pode disparar isto? Se a resposta inclui
-- 'qualquer um', ele precisa de limite antes de existir."* Podia qualquer um.
--
-- A deduplicacao e a MESMA do `record_banned_login_attempt`, de proposito: 30
-- minutos, e o repetido vira contador em vez de linha nova. "reativada 9 vezes
-- em 30 min" diz algo que nove linhas iguais nao dizem — que a pessoa esta
-- alternando.
--
-- Medido depois: 5 ciclos de alternancia geram **3 linhas** (era 11), com
-- `vezes=5` em cada.
--
-- **O que NAO foi feito, e e decisao de produto:** proibir o usuario comum de
-- reativar. `is_live` continua gravavel nos dois sentidos pelo autor (SEC-027),
-- porque o formulario de edicao depende disso.
--
-- ── Provado em ROLLBACK ───────────────────────────────────────────────────
--
--   encerrar grava live_ended_at ................. ok
--   reativar LIMPA live_ended_at ................. ok
--   apagar o post encerra a live ................. ok
--   estados impossiveis no banco ................. 0
--
-- A linha que ja existia (`cbb4bd23...`, "SEC-TEST live spam") e artefato de
-- laboratorio declarado no relatorio, e ja estava soft-deletada.

UPDATE public.posts SET is_live = false
 WHERE COALESCE(is_live,false) AND live_ended_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_live_ended_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  -- Apagar o post encerra a live. Vale para QUALQUER caminho de apagamento —
  -- a RPC, o painel, ou o que ainda nao existe (§BANCO, corrigir pela CLASSE).
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
     AND COALESCE(OLD.is_live,false) THEN
    NEW.is_live := false;
  END IF;

  IF COALESCE(NEW.is_live,false) = false AND COALESCE(OLD.is_live,false) = true THEN
    NEW.live_ended_at := now();
  ELSIF COALESCE(NEW.is_live,false) = true AND COALESCE(OLD.is_live,false) = false THEN
    -- Reativou: a live NAO terminou. Sem esta linha o post fica "no ar e
    -- encerrado" ao mesmo tempo.
    NEW.live_ended_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

-- A trava de 1a forca (§2): o estado impossivel passa a ser IMPOSSIVEL, nao
-- "improvavel porque o trigger cuida". `COALESCE` porque `is_live` e nullable e
-- `NOT (NULL AND ...)` daria NULL, que um CHECK aceita.
ALTER TABLE public.posts ADD CONSTRAINT posts_live_no_ar_nao_tem_fim
  CHECK (NOT (COALESCE(is_live,false) AND live_ended_at IS NOT NULL));

COMMENT ON CONSTRAINT posts_live_no_ar_nao_tem_fim ON public.posts IS
  'SEC-034: live no ar nao pode ter data de encerramento. Reativar limpa o campo (set_live_ended_at).';

CREATE OR REPLACE FUNCTION public.notify_admin_new_live()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  actor_name TEXT; actor_id UUID;
  v_tipo text; v_titulo text; v_msg text;
  v_recente uuid; v_vezes int;
BEGIN
  BEGIN
    actor_id := (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
    SELECT username INTO actor_name FROM profiles WHERE id = actor_id;
  EXCEPTION WHEN OTHERS THEN actor_id := NULL; actor_name := NULL;
  END;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.is_live,false) THEN
    v_tipo := 'new_live'; v_titulo := 'Live iniciada';
    v_msg := '"' || NEW.title || '" foi iniciada' || COALESCE(' por ' || actor_name, '');
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.is_live,false) = false AND COALESCE(NEW.is_live,false) = true THEN
    v_tipo := 'live_reactivated'; v_titulo := 'Live reativada';
    v_msg := '"' || NEW.title || '" foi reativada' || COALESCE(' por ' || actor_name, '');
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.is_live,false) = true AND COALESCE(NEW.is_live,false) = false THEN
    v_tipo := 'live_ended'; v_titulo := 'Live encerrada';
    v_msg := '"' || NEW.title || '" foi encerrada'
             || CASE WHEN actor_name IS NOT NULL THEN ' por ' || actor_name ELSE ' automaticamente' END;
  ELSE
    RETURN NEW;
  END IF;

  -- Ja existe alarme deste POST e deste TIPO na ultima meia hora? Entao a
  -- repeticao nao e noticia nova. Mesmo desenho do
  -- `record_banned_login_attempt` — a informacao fica MAIS completa, nao menos.
  SELECT id, COALESCE((metadata->>'vezes')::int, 1) INTO v_recente, v_vezes
    FROM admin_notifications
   WHERE type = v_tipo
     AND metadata->>'post_id' = NEW.id::text
     AND created_at > now() - interval '30 minutes'
   ORDER BY created_at DESC LIMIT 1;

  IF v_recente IS NOT NULL THEN
    UPDATE admin_notifications
       SET metadata = metadata || jsonb_build_object('vezes', v_vezes + 1, 'ultima_em', now()),
           message  = v_msg || ' (' || (v_vezes + 1) || ' vezes em 30 min)'
     WHERE id = v_recente;
    RETURN NEW;
  END IF;

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES (v_tipo, v_titulo, v_msg, 'all_admins',
          jsonb_build_object('post_id', NEW.id, 'vezes', 1));
  RETURN NEW;
END;
$fn$;
