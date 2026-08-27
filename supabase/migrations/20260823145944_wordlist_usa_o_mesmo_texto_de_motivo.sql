-- O trigger da lista de palavras tinha a frase do aviso escrita a mao. Passa a
-- usar `motivo_legivel('wordlist')`, para que TODO texto que o usuario le sobre
-- moderacao venha do mesmo lugar — duas copias divergem (§4).
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

  SELECT severity, word INTO v_pior, v_palavra
    FROM blocked_words
   WHERE v_texto ~* ('(^|[^[:alpha:]])' ||
                     regexp_replace(word, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                     CASE WHEN length(word) >= 4 THEN '(es|s)?' ELSE 's?' END ||
                     '([^[:alpha:]]|$)')
   ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_pior IS NULL OR v_pior = 'low' THEN RETURN NEW; END IF;

  IF v_pior = 'high' AND TG_TABLE_NAME = 'live_chat' THEN
    RAISE EXCEPTION 'Mensagem nao enviada: contem termo bloqueado.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_pior = 'high' THEN
    NEW.hidden_at := now();
    -- `NEW.user_id` ja esta em maos aqui, entao nao passa pelo helper (que le a
    -- linha — que ainda nao existe, por ser BEFORE INSERT). O TEXTO, porem, vem
    -- da mesma fonte que todo o resto.
    INSERT INTO notifications (user_id, type, message)
    VALUES (NEW.user_id, 'moderation',
      'Seu conteúdo foi ocultado automaticamente por ' || motivo_legivel('wordlist')
      || '. A equipe vai revisar — se for engano, ele volta ao ar.');
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
