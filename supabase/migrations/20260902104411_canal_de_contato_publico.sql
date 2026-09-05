-- ─────────────────────────────────────────────────────────────────────────────
-- Canal de contato PÚBLICO — falar com a administração de FORA do site
--
-- Pedido do dono em 02/09: "nós precisamos de uma maneira dos usuários falarem
-- com a administração de fora do site, nem que seja por formulário".
--
-- Por que uma tabela e não um e-mail (`mailto:`):
--   1. e-mail do dono no HTML vira alvo de robô de spam, e ele já pediu para
--      "tirar tudo o que é realmente meu desse site";
--   2. não deixa rastro nenhum do lado de cá — ninguém sabe se foi respondido;
--   3. mandar por `send-email` queimaria a cota do Gmail (~500/dia), que é a
--      MESMA do cadastro e da recuperação de senha. Um robô mandando formulário
--      derrubaria o cadastro do site inteiro.
--
-- Por que NÃO existe policy de INSERT nesta tabela: a única porta de entrada é
-- a RPC abaixo. Com policy de INSERT, qualquer um com a anon key (que é
-- pública por construção) faria POST direto em /rest/v1/contact_messages e
-- pularia TODA a validação e todo o limite de vazão.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Quem mandou, SE estava logado. Nulo é o caso normal: o canal existe
  -- justamente para quem não consegue entrar. `SET NULL` e não `CASCADE` —
  -- apagar a conta não pode apagar a conversa que a equipe teve com ela.
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_by_username text,
  handled_at timestamptz,
  internal_note text,
  -- Lista FECHADA nos dois lados. O mapa de rótulos do JS é conferido contra
  -- esta lista por um teste de contrato — valor novo aqui sem rótulo lá quebra
  -- o `npm test` em vez de virar um card sem legenda (§6 FASE 4).
  CONSTRAINT contact_messages_subject_check
    CHECK (subject IN ('banimento','conta','bug','denuncia','privacidade','outro')),
  CONSTRAINT contact_messages_status_check
    CHECK (status IN ('new','read','answered','spam'))
);

COMMENT ON TABLE public.contact_messages IS
  'Mensagens do formulario publico /contato. Entrada SO pela RPC enviar_mensagem_de_contato.';

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Só equipe lê. Ninguém mais — nem o próprio remetente autenticado: as
-- mensagens carregam e-mail e relato de terceiros, e uma policy "vejo as
-- minhas" abriria a porta para o remetente forjar `author_id`.
CREATE POLICY contact_messages_staff_select ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_staff());

-- UPDATE existe de propósito: tabela sem policy de UPDATE nega em SILÊNCIO
-- (0 linhas, nenhum erro) e o painel diria "marcado como lido" sem marcar nada.
CREATE POLICY contact_messages_staff_update ON public.contact_messages
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE INDEX contact_messages_status_created_idx
  ON public.contact_messages (status, created_at DESC);
-- Coberta o teto por e-mail da RPC, que roda em TODA tentativa de envio.
CREATE INDEX contact_messages_email_created_idx
  ON public.contact_messages (email, created_at DESC);
CREATE INDEX contact_messages_author_idx ON public.contact_messages (author_id);
CREATE INDEX contact_messages_handled_by_idx ON public.contact_messages (handled_by);

REVOKE ALL ON public.contact_messages FROM anon;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- O alarme de enchente mora num TRIGGER, e a razão é um erro que eu cometi
-- e que só apareceu porque o teste em ROLLBACK conferiu o alarme de verdade.
--
-- A primeira versão gravava em `admin_logs` dentro da própria RPC, logo antes
-- do `RAISE EXCEPTION` do disjuntor. Não funciona: o RAISE desfaz TUDO que a
-- função fez, inclusive o log. O alarme era decoração — exatamente o §1.5, no
-- código escrito para cumprir o §1.5.
--
-- No trigger ele viaja junto de um INSERT que dá certo (a 60ª mensagem, a que
-- fecha a porta atrás de si), então commita.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION public.alertar_enchente_de_contato() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $tg$
BEGIN
  IF (SELECT count(*) FROM contact_messages WHERE created_at > now() - interval '1 hour') >= 60
     AND NOT EXISTS (SELECT 1 FROM admin_logs
                      WHERE action = 'contact_flood' AND created_at > now() - interval '1 hour') THEN
    -- Uma linha por episódio, não uma por tentativa. Alarme que grita a cada
    -- requisição de uma enchente É a enchente, do lado de dentro (§0.2, 4ª regra).
    INSERT INTO admin_logs (action, details, category, severity, metadata, admin_id, admin_username)
    VALUES ('contact_flood',
      'Formulario de contato passou de 60 mensagens em uma hora e foi fechado temporariamente.',
      'security', 'warning', jsonb_build_object('teto_por_hora', 60), NULL, 'sistema');
  END IF;
  RETURN NULL;
END $tg$;

CREATE TRIGGER contact_messages_alerta_enchente
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.alertar_enchente_de_contato();

-- ─────────────────────────────────────────────────────────────────────────────
-- A única porta de entrada.
--
-- Faixa e não só tipo (§5): `text` aceita um megabyte, e `p_assunto` aceita
-- qualquer string. Cada limite abaixo tem número explícito e mensagem em
-- português, porque a mensagem chega na tela de quem escreveu.
--
-- Por que os dois limites de vazão devolvem a MESMA frase: o teto por e-mail
-- responderia "você já mandou 3" e isso é um oráculo — bastaria tentar com o
-- endereço de outra pessoa para descobrir que ela procurou a administração.
-- Mesma armadilha da porta do banido, que por isso leva ao login.
--
-- O que estes limites NÃO cobrem, dito com todas as letras: um robô com muitos
-- endereços diferentes ainda consegue encher a hora e fechar o canal para
-- todo mundo. Fechar isso de verdade pediria captcha (Turnstile), que exige
-- Edge Function e mais uma cota. No volume de hoje o disjuntor + o alarme são
-- a resposta proporcional; se um dia tocar, o caminho está escrito aqui.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION public.enviar_mensagem_de_contato(
  p_nome text, p_email text, p_assunto text, p_mensagem text)
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

  -- Disjuntor global: protege a tabela de virar depósito de robô. 60/hora é
  -- muito acima de qualquer uso real no volume atual e bem abaixo do que faria
  -- estrago.
  IF (SELECT count(*) FROM contact_messages
        WHERE created_at > now() - interval '1 hour') >= 60 THEN
    RAISE EXCEPTION '%', LIMITE_MSG;
  END IF;

  INSERT INTO contact_messages (name, email, subject, message, author_id)
  VALUES (v_nome, v_email, p_assunto, v_msg, auth.uid())
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

REVOKE ALL ON FUNCTION public.enviar_mensagem_de_contato(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_mensagem_de_contato(text,text,text,text) TO anon, authenticated;
