-- Por que esta migracao existe
--
-- Teste do dono no mural: "Se mata otario" foi barrado, mas "Se matem otarios"
-- passou inteiro — nem oculto, nem na fila. Os dois termos ESTAO na lista:
-- `se mata` (high) e `otario` (medium). O que falhou foi o CASAMENTO.
--
-- A regra e de palavra inteira, entao `otario` nao casa `otarios` e `se mata`
-- nao casa `se matem`. Na pratica, cada flexao precisaria de uma entrada
-- propria — o que e insustentavel e sempre vai ter buraco.
--
-- Isto e correcao de CLASSE, nao de caso: em vez de adicionar `otarios` a mao,
-- o casamento passa a tolerar sufixo de plural.
--
-- PLURAL GENERICO (aqui): `s` para termo de 2+ letras, `es` so a partir de 4.
--   O corte de 4 existe pra evitar `cu` -> `cues` (que e palavra inglesa e
--   aparece em texto de jogo). `cu` -> `cus` continua pegando.
--
-- CONJUGACAO DE VERBO nao tem como ser generica ("se mata" -> "se matem" nao e
-- sufixo), entao as formas que importam entram a mao — e as que importam sao as
-- de incitacao ao suicidio, que sao `high`.

CREATE OR REPLACE FUNCTION public.checar_palavras_bloqueadas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  -- Palavra INTEIRA (`[[:alpha:]]` e ciente de acento em UTF-8, entao "massa"
  -- nao casa "ass" e "curso" nao casa "cu"), com sufixo de plural opcional.
  -- O regexp_replace escapa metacaractere do proprio termo — a lista tem
  -- `foda-se` e `pack +18`.
  SELECT severity, word INTO v_pior, v_palavra
    FROM blocked_words
   WHERE v_texto ~* ('(^|[^[:alpha:]])' ||
                     regexp_replace(word, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                     CASE WHEN length(word) >= 4 THEN '(es|s)?' ELSE 's?' END ||
                     '([^[:alpha:]]|$)')
   ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_pior IS NULL OR v_pior = 'low' THEN RETURN NEW; END IF;

  -- Chat nao tem `hidden_at` e a mensagem ja foi lida por quem estava na sala:
  -- esconder depois nao repara nada, entao `high` e RECUSADO no envio.
  IF v_pior = 'high' AND TG_TABLE_NAME = 'live_chat' THEN
    RAISE EXCEPTION 'Mensagem nao enviada: contem termo bloqueado.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_pior = 'high' THEN
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

-- Conjugacoes que sufixo nenhum alcanca. Foco na incitacao ao suicidio e a
-- morte, que e o que justifica `high`.
INSERT INTO public.blocked_words (word, severity, created_by)
SELECT v.word, v.severity, NULL
  FROM (VALUES
    ('se matem','high'), ('matem se','high'), ('se matarem','high'),
    ('vao se matar','high'), ('vão se matar','high'),
    ('se enforquem','high'), ('va se enforcar','high'), ('vá se enforcar','high'),
    ('se joga da ponte','high'), ('se jogue da ponte','high'),
    -- plurais irregulares (-ao -> -oes, -l -> -is) que o sufixo generico nao pega
    ('viadoes','medium'), ('viadões','medium'),
    ('cuzoes','medium'), ('cuzões','medium'),
    ('mongois','high'), ('mongóis','high'),
    -- xingamento direto que apareceu no teste e nao estava na lista
    ('vai se ferrar','medium'), ('va se ferrar','medium'), ('vá se ferrar','medium')
  ) AS v(word, severity)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.blocked_words b WHERE lower(b.word) = lower(v.word)
 );;
