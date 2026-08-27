-- Por que esta migracao existe
--
-- Quando a IA ou a lista de palavras oculta algo, o autor nao recebe NADA: o
-- conteudo some da timeline dele sem aviso, sem explicacao, e fica assim ate um
-- admin abrir a fila. Do lado de quem postou, isso e indistinguivel de um bug —
-- e a reacao natural e postar de novo, achando que falhou.
--
-- A notificacao so existia quando o ADMIN aprovava o item na fila. Ou seja: a
-- acao automatica, que e a que mais acontece, era a unica muda.
--
-- Regra do CLAUDE.md §5: "toda acao de estado precisa dizer quem fica sabendo".
-- E §1.5: acao que so o alvo descobre sozinho e falha silenciosa com outro nome.
--
-- So avisa quando o conteudo foi de fato OCULTADO. `medium` da lista de
-- palavras publica normalmente e so vai pra fila — avisar ali seria assustar
-- alguem cujo post esta no ar.

-- Helper: quem escreveu, e como chamar aquilo na mensagem.
CREATE OR REPLACE FUNCTION public.avisar_autor_do_ocultamento(
  p_content_type text, p_content_id uuid, p_motivo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_autor uuid; v_rotulo text;
BEGIN
  -- Mapa explicito, sem `else` que engole tipo novo (§4). Tipo desconhecido
  -- sai daqui sem avisar ninguem, em vez de mandar mensagem errada.
  IF    p_content_type = 'post'    THEN
    SELECT user_id INTO v_autor FROM posts WHERE id = p_content_id;
    v_rotulo := 'Seu post';
  ELSIF p_content_type = 'comment' THEN
    SELECT user_id INTO v_autor FROM comments WHERE id = p_content_id;
    v_rotulo := 'Seu comentário';
  ELSIF p_content_type = 'mural'   THEN
    SELECT user_id INTO v_autor FROM community_posts WHERE id = p_content_id;
    v_rotulo := 'Sua mensagem no mural';
  ELSE
    RETURN;
  END IF;

  IF v_autor IS NULL THEN RETURN; END IF;

  -- A mensagem diz O QUE aconteceu, POR QUE e O QUE VEM DEPOIS. Aviso generico
  -- ("seu conteudo foi ocultado") nao ensina nada e so gera revolta.
  INSERT INTO notifications (user_id, type, message)
  VALUES (v_autor, 'moderation',
    v_rotulo || ' foi ocultado automaticamente por ' || p_motivo ||
    '. A equipe vai revisar — se for engano, ele volta ao ar.');
END;
$fn$;

REVOKE ALL ON FUNCTION public.avisar_autor_do_ocultamento(text, uuid, text) FROM PUBLIC, anon, authenticated;

-- 1. IA: avisa quando ocultou de fato.
CREATE OR REPLACE FUNCTION public.apply_ai_moderation(
  p_content_type text, p_content_id uuid, p_score double precision,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_enabled boolean; v_threshold float; v_ocultou boolean := false;
BEGIN
  SELECT COALESCE(value::boolean, false) INTO v_enabled FROM site_config WHERE key = 'mod_ai_enabled';
  IF NOT v_enabled THEN RETURN; END IF;
  SELECT COALESCE(value::float, 0.7) INTO v_threshold FROM site_config WHERE key = p_threshold_key;
  IF p_score < v_threshold THEN RETURN; END IF;

  IF p_content_type = 'post' THEN
    UPDATE posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'comment' THEN
    UPDATE comments SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'mural' THEN
    UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  END IF;
  -- FOUND reflete o UPDATE acima. `chat` nao entra em nenhum ramo, entao
  -- continua false — e mensagem de chat nao gera aviso, porque nao foi oculta.
  v_ocultou := FOUND AND p_content_type IN ('post','comment','mural');

  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai', jsonb_build_object('ai_score', p_score));

    INSERT INTO admin_logs (action, details, category, severity,
                            admin_id, admin_username, actor_id, actor_username, metadata)
    VALUES ('ai_moderation_hidden',
            format('IA ocultou %s (score %s)', p_content_type, round(p_score::numeric, 3)),
            'moderation', 'warning', NULL, 'sistema', NULL, 'sistema',
            jsonb_build_object('content_type', p_content_type,
                               'content_id', p_content_id, 'ai_score', p_score));
  END IF;

  IF v_ocultou THEN
    PERFORM avisar_autor_do_ocultamento(p_content_type, p_content_id,
      'suspeita de conteúdo que viola as regras da comunidade');
  END IF;
END;
$fn$;

-- 2. Lista de palavras: avisa quando `high` ocultou.
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
    -- Aviso direto ao autor: aqui o `NEW.user_id` ja esta em maos, entao nao
    -- precisa do helper (que le a linha — que ainda nao existe, e BEFORE INSERT).
    INSERT INTO notifications (user_id, type, message)
    VALUES (NEW.user_id, 'moderation',
      'Seu conteúdo foi ocultado automaticamente por conter termo não permitido. '
      || 'A equipe vai revisar — se for engano, ele volta ao ar.');
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
