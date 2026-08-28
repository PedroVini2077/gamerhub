-- O contador de login prometia o que não entregava, e era abusável.
--
-- Medido em 27/08/2026, não deduzido:
--   * 3 logins com senha errada direto no GoTrue -> o contador não saía de ZERO.
--     Ele só se movia quando o NOSSO frontend educadamente reportava a falha, e
--     atacante de verdade não reporta. Logo, nunca protegeu contra força bruta.
--   * 5 chamadas ANÔNIMAS a register_login_attempt -> conta marcada como
--     bloqueada, sem senha e sem sessão. Qualquer um fabricava alerta de
--     segurança para qualquer email, poluindo admin_logs e admin_notifications.
--     Mesma classe do edge_function_error: fadiga de alarme (CLAUDE.md §0.2).
--
-- A correção certa não é remendar a RPC — é tirar a decisão do cliente. O
-- Password Verification Hook faz o GoTrue avisar o banco a CADA verificação de
-- senha, com o veredicto dele. Aí o contador passa a contar o que realmente
-- aconteceu, e ninguém de fora consegue mexer nele.
--
-- ATENÇÃO — esta migration sozinha não liga nada. O hook só passa a ser chamado
-- depois de apontado no painel do Supabase em Authentication -> Hooks ->
-- Password Verification, para public.hook_de_verificacao_de_senha.

-- ---------------------------------------------------------------------------
-- A contagem, agora num lugar só.
--
-- Era o corpo de register_login_attempt. Virou função própria porque duas
-- portas precisavam da mesma regra, e regra duplicada diverge (§4). A diferença
-- é quem pode abrir a porta: esta aqui NÃO é chamável por anon nem por
-- authenticated, o que fecha a fabricação de alerta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contabilizar_falha_de_login(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_attempts integer := 0;
  v_blocked_until timestamptz;
  v_permanent boolean := false;
  v_username text;
BEGIN
  SELECT attempts, blocked_until, permanent INTO v_attempts, v_blocked_until, v_permanent
    FROM public.login_attempts WHERE email = v_email;
  v_attempts  := COALESCE(v_attempts, 0);
  v_permanent := COALESCE(v_permanent, false);

  -- Já bloqueado? Não conta de novo, devolve o estado atual.
  IF v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()) THEN
    RETURN jsonb_build_object('attempts', v_attempts, 'blocked', true,
      'permanent', v_permanent, 'blocked_until', v_blocked_until);
  END IF;

  v_attempts := v_attempts + 1;
  IF v_attempts >= 10 THEN
    v_permanent := true;  v_blocked_until := NULL;
  ELSIF v_attempts >= 5 THEN
    v_permanent := false; v_blocked_until := now() + INTERVAL '15 minutes';
  ELSE
    v_permanent := false; v_blocked_until := NULL;
  END IF;

  INSERT INTO public.login_attempts (email, attempts, blocked_until, permanent, updated_at)
  VALUES (v_email, v_attempts, v_blocked_until, v_permanent, now())
  ON CONFLICT (email) DO UPDATE
    SET attempts = EXCLUDED.attempts, blocked_until = EXCLUDED.blocked_until,
        permanent = EXCLUDED.permanent, updated_at = EXCLUDED.updated_at;

  -- Só chega aqui quando NÃO estava bloqueado antes: é transição real, não
  -- repetição. Sem isso a trilha encheria a cada tentativa de conta já travada.
  IF v_permanent OR v_blocked_until IS NOT NULL THEN
    SELECT p.username INTO v_username
      FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE au.email = v_email;

    INSERT INTO public.admin_logs
      (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
    VALUES (
      CASE WHEN v_permanent THEN 'auth_permanent_block' ELSE 'auth_rate_limited' END,
      CASE WHEN v_permanent
        THEN 'Login de ' || v_email || COALESCE(' (@' || v_username || ')', '') ||
             ' BLOQUEADO PERMANENTEMENTE após ' || v_attempts || ' tentativas falhas consecutivas'
        ELSE 'Login de ' || v_email || COALESCE(' (@' || v_username || ')', '') ||
             ' bloqueado por 15 min após ' || v_attempts || ' tentativas falhas consecutivas'
      END,
      'security', NULL, COALESCE(v_username, 'sistema'),
      CASE WHEN v_permanent THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('email', v_email, 'attempts', v_attempts,
        'permanent', v_permanent, 'blocked_until', v_blocked_until),
      NULL, 'sistema');

    INSERT INTO public.admin_notifications (type, title, message, audience, metadata)
    VALUES ('security_alert',
      CASE WHEN v_permanent THEN 'Conta bloqueada permanentemente' ELSE 'Conta bloqueada temporariamente' END,
      CASE WHEN v_permanent
        THEN 'A conta ' || v_email || ' foi bloqueada por segurança e precisa de revisão de um super admin.'
        ELSE 'A conta ' || v_email || ' foi bloqueada temporariamente por segurança.' END,
      'all_admins', jsonb_build_object('email', v_email, 'permanent', v_permanent));
  END IF;

  RETURN jsonb_build_object('attempts', v_attempts,
    'blocked', v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()),
    'permanent', v_permanent, 'blocked_until', v_blocked_until);
END $fn$;

REVOKE ALL ON FUNCTION public.contabilizar_falha_de_login(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- O hook em si.
--
-- Contrato do Supabase: recebe {user_id, valid} e devolve {decision}.
--
-- Devolve SEMPRE 'continue', e isso é decisão de produto, não esquecimento.
-- Recusar aqui transformaria o contador num portão de verdade — e um portão
-- desses é DoS de conta: bastaria errar a senha de alguém 10 vezes para trancar
-- a pessoa para fora. O GoTrue já tem rate limit próprio contra força bruta
-- (medido). O papel deste contador é AVISAR a equipe, e para avisar ele
-- precisava primeiro parar de mentir. É o que esta migration entrega.
--
-- O EXCEPTION que engole tudo também é proposital, e é a única vez que engolir
-- erro é o certo neste projeto: um defeito aqui dentro travaria o LOGIN DO SITE
-- INTEIRO, inclusive o do dono. Contabilidade de tentativa não vale isso.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hook_de_verificacao_de_senha(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user_id uuid;
  v_valid boolean;
  v_email text;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_valid   := (event->>'valid')::boolean;

  IF v_user_id IS NULL OR v_valid IS NULL THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  IF v_valid THEN
    -- Acertou a senha: zera o histórico. Sem isso, tentativas espalhadas ao
    -- longo de semanas somariam até o bloqueio de alguém que nunca foi atacado.
    DELETE FROM public.login_attempts WHERE email = v_email;
  ELSE
    PERFORM public.contabilizar_falha_de_login(v_email);
  END IF;

  RETURN jsonb_build_object('decision', 'continue');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('decision', 'continue');
END $fn$;

REVOKE ALL ON FUNCTION public.hook_de_verificacao_de_senha(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_de_verificacao_de_senha(jsonb) TO supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- A porta forjável fecha.
--
-- register_login_attempt era chamável por anon (precisava ser — a página de
-- login não está autenticada) e incrementava SEM verificar se o login falhou.
-- Some agora. O frontend passa a usar check_login_status, que é leitura pura e
-- devolve o mesmo formato.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.register_login_attempt(text);