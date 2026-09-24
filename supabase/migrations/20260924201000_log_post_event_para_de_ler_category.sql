-- ============================================================================
-- `[24/09]` O passo que FALTAVA antes de apagar `posts.category`
-- ============================================================================
--
-- O ACHADO, E ELE DESMENTE O QUE EU MESMO ESCREVI
-- ------------------------------------------------
-- A Fase 0 afirmou "nada no banco le `posts.category`". ERRADO. A varredura
-- de la usou `prosrc ILIKE '%category%'` e afogou o sinal em `admin_logs`,
-- que tem uma coluna com o MESMO NOME e aparece em dezenas de funcoes.
--
-- A conferencia de agora, feita porque `DROP COLUMN` e irreversivel, procurou
-- `\m(NEW|OLD)\.category\M` e achou o leitor: `log_post_event`, o trigger que
-- registra criacao, edicao e exclusao de post na trilha de auditoria.
--
-- Apagar a coluna antes disto QUEBRARIA PUBLICAR: `NEW.category` num trigger
-- de INSERT vira "record new has no field category" em tempo de execucao, e o
-- post nao entra. Medido em ROLLBACK, com o trigger antigo e a coluna apagada.
-- E a mesma classe das tres quedas do POSTURA.md — revogar sem perguntar quem le.
--
-- O QUE MUDA: tres pontos, todos cosmeticos na trilha.
--   . o texto do log de criacao perde o sufixo "(categoria: dica)"
--   . o `metadata` do log de criacao perde a chave `category`
--   . o `metadata` do log de exclusao perde a chave `category`
--
-- O que a trilha registra — quem, o que, quando — nao muda. A categoria nunca
-- foi escolhida por ninguem: 100% dos posts tinham o DEFAULT.
--
-- O QUE **NAO** MUDA: `admin_logs.category` (o 'content' das linhas abaixo) e
-- OUTRA coluna, de outra tabela, e continua intacta. Sao homonimas, e foi essa
-- homonimia que escondeu o leitor na primeira varredura.

CREATE OR REPLACE FUNCTION public.log_post_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_autor_id   uuid;
  v_autor_nome text;
  v_ator_id    uuid := auth.uid();
  v_ator_nome  text;
  v_por        text;  -- " por @fulano", só quando quem age NÃO é o autor
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_autor_id := NEW.user_id;
    SELECT username INTO v_autor_nome FROM profiles WHERE id = v_autor_id;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_created',
      format('Post "%s" criado por @%s',
        COALESCE(NEW.title,'sem título'), COALESCE(v_autor_nome,'?')),
      'content', v_autor_id, COALESCE(v_autor_nome,'?'), 'info','sistema',
      jsonb_build_object('post_id',NEW.id));
    RETURN NEW;
  END IF;

  v_autor_id := COALESCE(NEW.user_id, OLD.user_id);
  SELECT username INTO v_autor_nome FROM profiles WHERE id = v_autor_id;
  IF v_ator_id IS NOT NULL AND v_ator_id <> v_autor_id THEN
    SELECT username INTO v_ator_nome FROM profiles WHERE id = v_ator_id;
    v_por := ' por @' || COALESCE(v_ator_nome,'?');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Só loga edição de verdade: mexer só no marcador de live não é edição.
    IF OLD.title IS NOT DISTINCT FROM NEW.title AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
      RETURN NEW;
    END IF;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_edited',
      format('Post "%s" de @%s editado%s', COALESCE(NEW.title,'sem título'),
             COALESCE(v_autor_nome,'?'), COALESCE(v_por,' pelo próprio autor')),
      'content', COALESCE(v_ator_id, v_autor_id), COALESCE(v_ator_nome, v_autor_nome, '?'),
      CASE WHEN v_por IS NULL THEN 'info' ELSE 'warning' END, 'sistema',
      jsonb_build_object('post_id',NEW.id,'author_id',v_autor_id,'author_username',v_autor_nome));
    RETURN NEW;
  END IF;

  INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
  VALUES ('content_post_deleted',
    format('Post "%s" de @%s excluído%s', COALESCE(OLD.title,'sem título'),
           COALESCE(v_autor_nome,'?'), COALESCE(v_por,' pelo próprio autor')),
    'content', COALESCE(v_ator_id, v_autor_id), COALESCE(v_ator_nome, v_autor_nome, '?'),
    CASE WHEN v_por IS NULL THEN 'info' ELSE 'warning' END, 'sistema',
    jsonb_build_object('post_id',OLD.id,
                       'author_id',v_autor_id,'author_username',v_autor_nome));
  RETURN OLD;
END;
$function$;
