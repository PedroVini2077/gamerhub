-- ─────────────────────────────────────────────────────────────────────────────
-- Responder a mensagem de contato — e o status "respondida" deixar de mentir
--
-- O DEFEITO QUE ISTO FECHA, relatado pelo dono em 03/09 testando o canal:
-- *"como vou clicar no respondido sendo que não tem como responder nada?"*.
--
-- Ele estava certo, e o problema não era falta de feature: era HONESTIDADE. O
-- status `answered` existia desde 02/09 e nada no sistema enviava resposta
-- nenhuma. Quem abrisse o painel depois não tinha como distinguir "respondi por
-- fora" de "cliquei sem responder" — um carimbo afirmando um ato que o sistema
-- nunca executou (§1.5).
--
-- A partir daqui `answered` é CONSEQUÊNCIA de um envio que aconteceu, e não um
-- botão que alguém aperta. Por isso a coluna guarda o TEXTO: sem ele, o painel
-- continuaria dizendo "respondida" sem dizer o quê.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contact_messages ADD COLUMN reply_text text;

COMMENT ON COLUMN public.contact_messages.reply_text IS
  'O que a equipe respondeu. Preenchido SO por contato_registrar_resposta, depois de o e-mail sair.';

-- Faixa e não só tipo (§5): `text` aceita um megabyte. O piso de 10 existe
-- porque resposta de uma palavra não é resposta; o teto de 4000 é o que cabe
-- num e-mail sem virar outra coisa.
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_reply_len
  CHECK (reply_text IS NULL OR char_length(reply_text) BETWEEN 10 AND 4000);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O que a Edge Function precisa saber para montar o e-mail.
--
-- SECURITY DEFINER com checagem interna de `is_staff()`, e não `SELECT` direto:
-- a policy de SELECT da tabela já limita à equipe, mas a função também PRECISA
-- recusar explicitamente — a Edge Function roda com a credencial de quem chamou,
-- e uma função que confia no chamador é a porta decorativa do §1.3.
--
-- Hierarquia escrita como `is_staff()`, nunca lista literal de cargo: lista à
-- mão já esqueceu `owner` 14 vezes neste projeto.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION public.contato_dados_para_resposta(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Apenas a equipe pode responder mensagens de contato.';
  END IF;

  SELECT jsonb_build_object(
           'email', email, 'nome', name, 'assunto', subject,
           'mensagem', message, 'status', status)
    INTO v
    FROM contact_messages WHERE id = p_id;

  -- Nulo é ambíguo do outro lado (§1.5): "não existe" e "não tenho permissão"
  -- levam a investigações diferentes. Aqui a permissão já foi resolvida acima,
  -- então isto só pode ser mensagem inexistente — e diz isso.
  IF v IS NULL THEN
    RAISE EXCEPTION 'Mensagem de contato nao encontrada.';
  END IF;

  RETURN v;
END $fn$;

REVOKE ALL ON FUNCTION public.contato_dados_para_resposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contato_dados_para_resposta(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O registro, que só acontece DEPOIS de o e-mail ter saído.
--
-- A ordem importa e é o ponto do arquivo: gravar antes de enviar produziria
-- exatamente o defeito que estamos consertando — o painel dizendo "respondida"
-- com o envio tendo falhado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION public.contato_registrar_resposta(p_id uuid, p_texto text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_texto text := btrim(coalesce(p_texto, ''));
  v_username text;
  v_email text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Apenas a equipe pode responder mensagens de contato.';
  END IF;
  IF char_length(v_texto) < 10 OR char_length(v_texto) > 4000 THEN
    RAISE EXCEPTION 'A resposta precisa ter entre 10 e 4000 caracteres.';
  END IF;

  SELECT username INTO v_username FROM profiles WHERE id = auth.uid();

  UPDATE contact_messages
     SET status = 'answered',
         reply_text = v_texto,
         handled_by = auth.uid(),
         handled_by_username = v_username,
         handled_at = now()
   WHERE id = p_id
  RETURNING email INTO v_email;

  -- Zero linhas aqui é a mensagem não existir: a permissão já foi checada, e o
  -- SECURITY DEFINER passa por cima da RLS. Sem este IF a função devolveria
  -- sucesso sem ter mudado nada — o §1.5 na forma mais comum.
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Mensagem de contato nao encontrada.';
  END IF;

  -- A trilha, porque resposta a alguém de fora é ação de moderação: alguém
  -- falou em nome do site. O e-mail do destinatário NÃO entra no metadata —
  -- a trilha é lida por toda a equipe, e o endereço já está na própria linha
  -- da mensagem para quem tiver acesso a ela.
  INSERT INTO admin_logs (action, details, category, severity, metadata,
                          admin_id, admin_username)
  VALUES ('contact_reply',
          'Respondeu uma mensagem do formulario de contato.',
          'moderation', 'info',
          jsonb_build_object('contact_id', p_id, 'tamanho', char_length(v_texto)),
          auth.uid(), v_username);

  RETURN jsonb_build_object('ok', true);
END $fn$;

REVOKE ALL ON FUNCTION public.contato_registrar_resposta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contato_registrar_resposta(uuid, text) TO authenticated;
