-- ============================================================================
-- `[17/09]` Dois achados da parte da auditoria que faltava ler
-- ============================================================================
--
-- O piso do §6 já estava fechado (26 de 26 das que escrevem e são alcançáveis
-- por quem tem conta). Estes dois saíram das 23 que ainda não tinham sido
-- lidas — e os dois são do mesmo tipo: **nada quebrado hoje, por acidente.**
--
--
-- ── 🟡 SEC-022 · `check_login_status` é uma porta MORTA, aberta ao anônimo ──
--
-- Qualquer pessoa sem conta pergunta por **qualquer e-mail** e recebe de volta
-- `attempts`, `blocked`, `permanent` e `blocked_until`.
--
-- **Por que é inofensiva hoje, e por que isso não basta.** A tabela
-- `login_attempts` está vazia e continua vazia: o hook que a alimentaria é de
-- plano pago. Então a função responde sempre `attempts: 0, blocked: false`,
-- para qualquer e-mail — inclusive os que não existem.
--
-- A proteção, portanto, **não é a função**: é a tabela estar vazia. No dia em
-- que o plano subir e ela encher, esta RPC vira um **oráculo de enumeração**
-- para quem não tem conta: *"este e-mail tem tentativas registradas?"* responde
-- se o endereço existe **e** se está sob ataque. §1.3: *"se algo só está seguro
-- por efeito colateral de outra regra, isso não é proteção — é sorte esperando
-- expirar"*.
--
-- **E o pior: ninguém chama.** Varrido `src/`, `supabase/functions/`, `e2e/` e
-- `scripts/` — **nenhuma chamada**. A tela de login parou de usá-la em 11/09,
-- quando a promessa de bloqueio saiu de lá. O grant ficou.
--
-- Isso encerra a discussão sobre a régua de papéis dele (*"não quero que anon
-- veja nada"*): a justificativa que abria esta porta **expirou há seis dias** e
-- ninguém fechou.
--
-- A função **fica** — ela é correta e faz parte do conjunto guardado para o dia
-- do upgrade. O que sai é o acesso.
--
--
-- ── 🟡 SEC-023 · o alarme de "banido tentou entrar" não tem teto ────────────
--
-- `record_banned_login_attempt` grava uma linha em `admin_logs` **e** uma
-- notificação para **toda a equipe**, a cada chamada. Não há limite de
-- repetição.
--
-- O guard de identidade está **certo** e foi conferido: só dá para reportar o
-- **próprio** e-mail (`v_caller_email <> v_email` recusa). Não é forjável — foi
-- exatamente a brecha fechada em 28/08. O problema é outro: a pessoa banida
-- pode chamar quantas vezes quiser sobre si mesma, e ela tem motivo para ficar
-- tentando entrar.
--
-- **Medido, e já está acontecendo sem ninguém atacando:**
--
--   9 linhas em 28 MINUTOS   (um e-mail, 28/08)
--   2 linhas em 34 SEGUNDOS  (outro, 13/09)
--   22 linhas no total, num site com 5 contas
--
-- Isso é o que **uso normal** produz — alguém banido clicando em "entrar" de
-- novo. Uma pessoa irritada faz dezenas.
--
-- É a 4ª regra do §0.2 na letra: *"alarme que grita à toa é o mesmo problema,
-- do outro lado"*. Consertar o silêncio produzindo fadiga de alarme cega igual
-- — uma esconde o sinal em nada, a outra em ruído. E foi assim que
-- `edge_function_error` virou a 2ª ação mais frequente da trilha com 68 de 68
-- falsos.
--
-- ── O conserto NÃO é deixar de avisar ───────────────────────────────────────
--
-- O sinal importa: conta banida insistindo em entrar é informação de segurança.
-- O que muda é a FORMA — dentro de uma janela de 30 minutos, a repetição
-- **atualiza a linha que já existe** em vez de criar outra, e o contador passa
-- a fazer parte da história.
--
-- Nove tentativas viram **uma linha dizendo "9 vezes"**, e não nove linhas
-- dizendo "1 vez". É o mesmo desenho do `lib/tetoDeEventos.js`, que transformou
-- uma rajada de 1.000 erros do Sentry em 21: o estouro vira **um** evento que
-- conta a história, em vez de mil ou de nenhum.
--
-- A notificação para a equipe só sai na primeira da janela — é ela que precisa
-- interromper alguém.
-- ============================================================================

-- ── SEC-022 · fecha a porta, mantém a função ────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.check_login_status(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.check_login_status(text) IS
  'Estado de bloqueio de login de um e-mail. SEM grant para anon/authenticated desde 17/09 (SEC-022): ninguem no projeto a chama desde 11/09, e com `login_attempts` cheia ela seria oraculo de enumeracao para quem nao tem conta. Guardada para o dia em que o hook de plano pago existir — ao religar, conceda so a quem precisa e escreva a tela que a usa.';


-- ── SEC-023 · o alarme ganha teto, sem perder o sinal ───────────────────────
CREATE OR REPLACE FUNCTION public.record_banned_login_attempt(p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_email        text := lower(trim(p_email));
  v_username     text;
  v_caller_email text;
  v_recente      uuid;
  v_vezes        int;
BEGIN
  -- Inalterado, e é o guard que impede forjar: só o PRÓPRIO e-mail. Foi a
  -- brecha fechada em 28/08, quando qualquer um marcava a conta de qualquer um.
  SELECT lower(email) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_caller_email IS NULL OR v_caller_email <> v_email THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT p.username INTO v_username
    FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE au.email = v_email;

  -- Já existe um alarme deste e-mail na última meia hora? Então a tentativa
  -- nova não é notícia nova: ela é a MESMA notícia acontecendo de novo.
  SELECT id, COALESCE((metadata->>'vezes')::int, 1)
    INTO v_recente, v_vezes
    FROM admin_logs
   WHERE action = 'auth_banned_attempt'
     AND metadata->>'email' = v_email
     AND created_at > now() - interval '30 minutes'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_recente IS NOT NULL THEN
    -- Atualiza a linha que já existe. A informação não se perde — ela fica
    -- MAIS completa, porque "9 vezes" diz algo que nove linhas iguais não
    -- dizem: que a pessoa está insistindo.
    UPDATE admin_logs
       SET metadata = metadata
                    || jsonb_build_object('vezes', v_vezes + 1,
                                          'ultima_em', now()),
           details  = 'Conta banida tentou fazer login: '
                    || COALESCE('@' || v_username, v_email)
                    || ' (' || (v_vezes + 1) || ' vezes em 30 min)'
     WHERE id = v_recente;
    RETURN;
  END IF;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auth_banned_attempt', 'Conta banida tentou fazer login: ' || COALESCE('@' || v_username, v_email),
    'security', NULL, 'sistema', 'warning',
    jsonb_build_object('email', v_email, 'username', v_username, 'vezes', 1), NULL, 'sistema');

  -- A notificação sai só na PRIMEIRA da janela: ela interrompe uma pessoa, e
  -- interromper alguém nove vezes pela mesma coisa e o caminho mais curto para
  -- essa pessoa parar de olhar o canal.
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('banned_login_attempt', 'Tentativa de acesso de banido',
    'Uma conta banida' || COALESCE(' (@' || v_username || ')', '') || ' tentou fazer login.',
    'all_admins', jsonb_build_object('email', v_email, 'username', v_username));
END;
$fn$;
