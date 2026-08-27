-- Por que esta migracao existe
--
-- No chat de live, termo `high` so era barrado pelo FILTRO DO CLIENTE
-- (`useLiveChat` -> `checkContent`). O trigger enfileirava para revisao e
-- deixava a mensagem entrar. Como o site usa a anon key, qualquer pessoa chama
-- a REST API direto e pula o cliente inteiro — ou seja, na pratica nao havia
-- protecao nenhuma contra o pior tipo de termo no unico lugar do site que e
-- lido AO VIVO por todo mundo na sala.
--
-- Post/comentario/mural podem ser OCULTADOS depois (tem `hidden_at`), entao la
-- "deixa entrar e esconde" funciona. Chat nao tem `hidden_at` e a mensagem ja
-- foi lida por quem estava na sala no instante em que apareceu — esconder
-- depois nao repara nada. A unica protecao real e RECUSAR o envio.
--
-- `medium` no chat continua como estava: passa e vai pra fila do admin.

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

  -- Palavra INTEIRA: `[[:alpha:]]` e ciente de acento em UTF-8, entao "massa"
  -- nao casa com "ass" e "curso" nao casa com "cu". O regexp_replace escapa
  -- metacaractere no termo (a lista tem `foda-se`, `pack +18`), senao o proprio
  -- termo viraria sintaxe de regex.
  SELECT severity, word INTO v_pior, v_palavra
    FROM blocked_words
   WHERE v_texto ~* ('(^|[^[:alpha:]])' ||
                     regexp_replace(word, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                     '([^[:alpha:]]|$)')
   ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_pior IS NULL OR v_pior = 'low' THEN RETURN NEW; END IF;

  -- A MUDANCA: no chat, `high` nao entra. Ver o cabecalho para o porque.
  -- A mensagem do RAISE e a que o usuario le no toast, entao e escrita para ele.
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
$fn$;;
