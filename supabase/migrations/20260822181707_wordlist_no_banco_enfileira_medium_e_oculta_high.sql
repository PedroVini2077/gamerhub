-- Lista de palavras passa a valer NO BANCO.
--
-- Pedido do dono: palavra `medium` (palavrao comum) nao bloqueia o envio, mas
-- "uma hora tem que punir" — entao passa a ENFILEIRAR para revisao. Assim
-- reincidente aparece na fila do admin sem censurar quem xinga uma vez.
--
-- Ao desenhar, apareceu um problema maior: TODA a moderacao era disparada pelo
-- CLIENTE. O bloqueio de `high` acontecia no formulario, e a IA so roda porque
-- o cliente chama a Edge Function. Quem usasse a REST API direto (a anon key e
-- publica, esta no bundle) pulava as duas coisas. A lista era cosmetica contra
-- alguem determinado — exatamente o que o CLAUDE.md §1.3 proibe: "validacao no
-- cliente nao vale nada sozinha".
--
-- Este trigger fecha isso. Roda BEFORE INSERT em post, comentario, mural e
-- chat, e nao tem como ser pulado.
--
-- O que faz, seguindo a nota de arquitetura do projeto ("sempre soft-hide,
-- nunca delete automatico"):
--
--   high    -> OCULTA na hora (reversivel) e enfileira. Nao rejeita o insert:
--              rejeitar tornaria um falso-positivo da lista uma parede sem
--              recurso, e o moderador humano perderia a chance de revisar.
--              (No chat de live nao oculta — e efemero; so enfileira.)
--   medium  -> NAO oculta, so enfileira. E o que o dono pediu.
--   low     -> nada.
--
-- O filtro do formulario continua existindo para dar resposta imediata a quem
-- digita. A diferenca e que agora ele e conveniencia, nao a defesa.
--
-- Detalhes de implementacao:
--   * match por PALAVRA INTEIRA e sem diferenciar maiuscula, igual ao cliente.
--     `[[:alpha:]]` respeita acento em UTF-8.
--   * o termo e escapado antes de virar regex — a lista tem entrada com
--     metacaractere ("pack +18").
--   * pega a de MAIOR severidade, nao a primeira encontrada.
--   * grava `wordlist_flag` na trilha de auditoria.
--
-- Testado em ROLLBACK, 4 casos: medium fica visivel e enfileira; high oculta e
-- enfileira; texto limpo nao enfileira; "esse jogo tem conteudo adulto"
-- (medium de proposito) enfileira sem ocultar.

CREATE OR REPLACE FUNCTION public.checar_palavras_bloqueadas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_texto   text;
  v_tipo    text;
  v_pior    text;
  v_palavra text;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    v_texto := coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,'');
    v_tipo  := 'post';
  ELSIF TG_TABLE_NAME = 'comments' THEN
    v_texto := coalesce(NEW.content,''); v_tipo := 'comment';
  ELSIF TG_TABLE_NAME = 'community_posts' THEN
    v_texto := coalesce(NEW.message,''); v_tipo := 'mural';
  ELSE
    v_texto := coalesce(NEW.message,''); v_tipo := 'chat';
  END IF;

  SELECT severity, word INTO v_pior, v_palavra
    FROM blocked_words
   WHERE v_texto ~* ('(^|[^[:alpha:]])' ||
                     regexp_replace(word, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') ||
                     '([^[:alpha:]]|$)')
   ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_pior IS NULL OR v_pior = 'low' THEN RETURN NEW; END IF;

  IF v_pior = 'high' AND TG_TABLE_NAME <> 'live_chat' THEN
    NEW.hidden_at := now();
  END IF;

  INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
  VALUES (v_tipo, NEW.id, 'wordlist',
          jsonb_build_object('palavra', v_palavra, 'severidade', v_pior));

  INSERT INTO admin_logs (action, details, category, severity,
                          admin_id, admin_username, actor_id, actor_username, metadata)
  VALUES ('wordlist_flag',
          format('Lista de palavras marcou %s (termo "%s", %s)', v_tipo, v_palavra, v_pior),
          'moderation', CASE WHEN v_pior='high' THEN 'warning' ELSE 'info' END,
          NULL, 'sistema', NULL, 'sistema',
          jsonb_build_object('content_type', v_tipo, 'content_id', NEW.id,
                             'palavra', v_palavra, 'severidade', v_pior));
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_wordlist_posts ON public.posts;
CREATE TRIGGER trg_wordlist_posts BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.checar_palavras_bloqueadas();

DROP TRIGGER IF EXISTS trg_wordlist_comments ON public.comments;
CREATE TRIGGER trg_wordlist_comments BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.checar_palavras_bloqueadas();

DROP TRIGGER IF EXISTS trg_wordlist_mural ON public.community_posts;
CREATE TRIGGER trg_wordlist_mural BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.checar_palavras_bloqueadas();

DROP TRIGGER IF EXISTS trg_wordlist_chat ON public.live_chat;
CREATE TRIGGER trg_wordlist_chat BEFORE INSERT ON public.live_chat
  FOR EACH ROW EXECUTE FUNCTION public.checar_palavras_bloqueadas();;
