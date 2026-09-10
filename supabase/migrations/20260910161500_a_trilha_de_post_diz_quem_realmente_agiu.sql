-- ============================================================================
-- SEC-010 — a trilha atribuía ao AUTOR a ação feita por outra pessoa
-- ============================================================================
--
-- `log_post_event` gravava `actor_id := NEW.user_id` no UPDATE e `OLD.user_id`
-- no DELETE — ou seja, **o dono do post**, nunca quem executou. Staff editando
-- ou apagando post alheio aparecia na trilha como se o próprio autor tivesse
-- feito, com `severity = info`.
--
-- É a mesma família do SEC-007 (a trilha não pode mentir) e ficou de fora
-- daquele conserto porque é mudança de TRIGGER, não de tela. E é o que impediu
-- de auditar se alguém usou a brecha do SEC-009 antes de ela ser fechada.
--
-- O QUE MUDA
-- ----------
--   • `actor_id`/`actor_username` passam a ser **quem agiu** (`auth.uid()`),
--     com queda para o autor quando não há sessão — que é o caso do cron
--     (`cleanup-expired-posts`) e de qualquer caminho de service role.
--   • O texto passa a nomear os dois: *"Post X de @autor excluído por @fulano"*,
--     ou *"...excluído pelo próprio autor"* quando são a mesma pessoa.
--   • `severity` vira `warning` quando quem age NÃO é o autor. Ação de staff
--     sobre conteúdo alheio merece destaque; a própria pessoa apagando o
--     próprio post continua `info` — senão vira o alarme que grita à toa
--     (§0.2, 4ª regra).
--   • `metadata` ganha `author_id`/`author_username`, para a informação de
--     antes não se perder.
--
-- O INSERT não muda: quem cria o post é sempre o autor.
--
-- PROVADO EM ROLLBACK, os três casos
-- ----------------------------------
--     1_staff_apaga   ator="claudestaff"  sev=warning :: Post "ALVO-STAFF" de @claudetester excluído por @claudestaff
--     2_autor_apaga   ator="claudetester" sev=info    :: Post "ALVO-PROPRIO" de @claudetester excluído pelo próprio autor
--     3_staff_edita   ator="claudestaff"  sev=warning :: Post "ALVO-EDIT" de @claudetester editado por @claudestaff
--
-- (O primeiro teste deu os dois casos idênticos e foi descartado: `now()` é
-- constante dentro da transação, então `ORDER BY created_at LIMIT 1` escolhia
-- qualquer uma das duas linhas. Refeito buscando por `metadata->>'post_id'`.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_post_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
      format('Post "%s" criado por @%s (categoria: %s)',
        COALESCE(NEW.title,'sem título'), COALESCE(v_autor_nome,'?'), COALESCE(NEW.category,'geral')),
      'content', v_autor_id, COALESCE(v_autor_nome,'?'), 'info','sistema',
      jsonb_build_object('post_id',NEW.id,'category',NEW.category));
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
    jsonb_build_object('post_id',OLD.id,'category',OLD.category,
                       'author_id',v_autor_id,'author_username',v_autor_nome));
  RETURN OLD;
END;
$fn$;
