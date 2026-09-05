-- ─────────────────────────────────────────────────────────────────────────────
-- Captcha no formulário de contato — a RPC deixa de ser chamável por `anon`
--
-- O QUE ISTO FECHA, e está escrito na migration de 02/09 que criou o canal:
-- os limites de lá (3 mensagens por e-mail em 24 h, disjuntor de 60/hora)
-- impedem a tabela de virar depósito, mas NÃO impedem um robô com muitos
-- endereços diferentes de encher a hora e fechar o canal para todo mundo.
--
-- POR QUE O REVOKE É A PARTE QUE IMPORTA, e não o widget na tela: enquanto
-- `anon` puder chamar `/rest/v1/rpc/enviar_mensagem_de_contato`, o captcha é
-- decoração — ele valeria só para quem já não era ameaça. O site entrega a
-- anon key para qualquer um (§1.3): regra que só existe no cliente não existe.
--
-- A partir daqui a única porta é a Edge Function `verify-contact`, que confere
-- o token no Cloudflare e chama esta função com `service_role`.
--
-- ANTES DE REVOGAR, PROCUREI QUEM LÊ (POSTURA.md §1.3) — revoke bem-intencionado
-- já derrubou este site três vezes:
--   grep no src/ ............ só `services/contatoService.js` chama a RPC
--   pg_policies ............. nenhuma policy cita esta função
--   pg_proc ................. nenhuma outra função a chama
--   triggers ................ nenhum
--
-- A JANELA DE RISCO, dita antes: entre esta migration e o deploy do site novo,
-- um visitante que carregou a página ANTES e envia DEPOIS recebe erro de
-- permissão. Por isso a ordem de aplicação é: função no ar -> site no ar ->
-- só então esta migration. Nunca o contrário.
-- ─────────────────────────────────────────────────────────────────────────────

-- O `author_id` deixou de vir de `auth.uid()` porque quem chama agora é a Edge
-- Function com `service_role` — ali `auth.uid()` é nulo, e o dado se perderia
-- em silêncio. Ele passa a ser parâmetro, e não é forjável: a função só é
-- executável por `service_role`, e a Edge Function deriva o id de um JWT que o
-- próprio Supabase valida.
--
-- `DEFAULT NULL` para o caso normal deste canal, que é a pessoa NÃO estar
-- logada — o formulário existe justamente para quem não consegue entrar.
DROP FUNCTION IF EXISTS public.enviar_mensagem_de_contato(text, text, text, text);

CREATE FUNCTION public.enviar_mensagem_de_contato(
  p_nome text, p_email text, p_assunto text, p_mensagem text,
  p_author_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome  text := btrim(coalesce(p_nome, ''));
  v_msg   text := btrim(coalesce(p_mensagem, ''));
  LIMITE_MSG constant text := 'Muitas mensagens enviadas recentemente. Tente novamente mais tarde.';
  v_id uuid;
BEGIN
  IF length(v_nome) < 2 OR length(v_nome) > 60 THEN
    RAISE EXCEPTION 'Informe um nome entre 2 e 60 caracteres.';
  END IF;
  IF length(v_email) > 120
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail valido para a equipe poder responder.';
  END IF;
  IF p_assunto IS NULL
     OR p_assunto NOT IN ('banimento','conta','bug','denuncia','privacidade','outro') THEN
    RAISE EXCEPTION 'Escolha um assunto valido.';
  END IF;
  IF length(v_msg) < 20 THEN
    RAISE EXCEPTION 'Escreva pelo menos 20 caracteres explicando o seu caso.';
  END IF;
  IF length(v_msg) > 2000 THEN
    RAISE EXCEPTION 'A mensagem pode ter no maximo 2000 caracteres.';
  END IF;

  -- Teto por remetente: 3 em 24 h. Quem precisa mesmo falar com a equipe manda
  -- uma; quem manda a quarta em um dia está usando o canal para outra coisa.
  IF (SELECT count(*) FROM contact_messages
        WHERE email = v_email AND created_at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION '%', LIMITE_MSG;
  END IF;

  -- Disjuntor global: protege a tabela de virar depósito de robô. Continua
  -- valendo COM captcha — captcha para robô comum, não para quem paga serviço
  -- de resolução. Defesa em profundidade, não substituição.
  IF (SELECT count(*) FROM contact_messages
        WHERE created_at > now() - interval '1 hour') >= 60 THEN
    RAISE EXCEPTION '%', LIMITE_MSG;
  END IF;

  INSERT INTO contact_messages (name, email, subject, message, author_id)
  VALUES (v_nome, v_email, p_assunto, v_msg, p_author_id)
  RETURNING id INTO v_id;

  -- O terceiro canal do §1.5: sem isto a mensagem cairia numa tabela que
  -- ninguém tem motivo para abrir, e "mandei e nunca responderam" seria
  -- indistinguível de "o formulário está quebrado".
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('contact_message', 'Nova mensagem de contato',
    'Assunto: ' || p_assunto || ' - de ' || v_nome,
    'all_admins', jsonb_build_object('contact_id', v_id, 'assunto', p_assunto));

  RETURN jsonb_build_object('ok', true);
END $fn$;

COMMENT ON FUNCTION public.enviar_mensagem_de_contato(text,text,text,text,uuid) IS
  'Unica porta de escrita em contact_messages. Chamavel SO pela Edge Function '
  'verify-contact (service_role), que confere o captcha antes. Ver a migration '
  '20260903213000_captcha_no_contato.sql.';

-- O revoke. `anon` e `authenticated` saem os dois: um usuário logado que
-- chamasse direto pularia o captcha igualzinho a um anônimo, e a diferença
-- entre os dois não muda o estrago (encher a hora e fechar o canal).
REVOKE ALL ON FUNCTION public.enviar_mensagem_de_contato(text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_mensagem_de_contato(text,text,text,text,uuid)
  TO service_role;
