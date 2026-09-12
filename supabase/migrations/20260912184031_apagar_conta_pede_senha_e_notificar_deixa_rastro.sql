-- `[12/09]` SEC-012 e SEC-013, achados no BLOCO B da auditoria profunda e
-- aprovados pelo dono.

-- ══ SEC-012 · apagar a conta é IRREVERSÍVEL e não pedia senha ═══════════════
--
-- `delete_own_account()` era uma linha: `DELETE FROM auth.users WHERE id =
-- auth.uid()`. A ação mais destrutiva do site atrás de um `ConfirmModal` — que
-- é validação de CLIENTE, e o §1.3 diz que isso não vale nada, porque a
-- `anon key` permite chamar `/rest/v1/rpc/delete_own_account` direto. Sessão
-- deixada aberta apagava a conta com uma requisição.
--
-- O projeto já tinha a peça certa no lugar MENOS grave: o `ResetDoCofre` (ação
-- reversível) confere a senha no servidor.
--
-- ── Por que NÃO dá para reusar `confere_a_propria_senha` ────────────────────
--
-- Ela tem `AND public.is_super()` embutido: só o fundador passa. Relaxá-la
-- enfraqueceria o cofre. Então a COMPARAÇÃO DE SENHA sai para um auxiliar, e as
-- duas passam a chamá-lo — uma implementação só do `crypt`, que é o §4.
--
-- `a_senha_confere` é INTERNA: `REVOKE` de todo mundo. Ninguém a chama pela
-- REST. As duas que a usam são `SECURITY DEFINER` e rodam como o dono da
-- função, então o `EXECUTE` é checado contra o dono, não contra quem chamou.
-- Sem isso, ela seria um oráculo de senha sem limite de tentativa.

CREATE OR REPLACE FUNCTION public.a_senha_confere(p_senha text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.encrypted_password = extensions.crypt(p_senha, u.encrypted_password)
  );
$$;
REVOKE ALL ON FUNCTION public.a_senha_confere(text) FROM PUBLIC, anon, authenticated;

-- Passa a delegar. O `is_super()` continua aqui, e só aqui.
CREATE OR REPLACE FUNCTION public.confere_a_propria_senha(p_senha text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$ SELECT public.a_senha_confere(p_senha) AND public.is_super(); $$;

-- O DROP é a parte que faz o conserto valer: deixar a versão sem senha no ar
-- manteria a porta aberta ao lado da nova, e a correção seria decorativa.
DROP FUNCTION IF EXISTS public.delete_own_account();

CREATE OR REPLACE FUNCTION public.delete_own_account(p_senha text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE v_id uuid := auth.uid(); v_username text;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'Precisa estar autenticado.'; END IF;
  IF p_senha IS NULL OR length(p_senha) = 0 THEN
    RAISE EXCEPTION 'Digite sua senha para confirmar a exclusao.';
  END IF;
  IF NOT public.a_senha_confere(p_senha) THEN
    RAISE EXCEPTION 'Senha incorreta.';
  END IF;

  SELECT username INTO v_username FROM profiles WHERE id = v_id;

  -- A trilha vai ANTES do DELETE, e isso é conserto de uma falha silenciosa: o
  -- cliente gravava o log DEPOIS de a conta sumir, ou seja como um usuário que
  -- já não existe. Aqui ela é garantida.
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username,
                          severity, metadata, admin_id, admin_username)
  VALUES ('auth_account_deleted',
          '@' || coalesce(v_username, '?') || ' apagou a propria conta.',
          'security', v_id, v_username, 'warning',
          jsonb_build_object('username', v_username), NULL, 'sistema');

  DELETE FROM auth.users WHERE id = v_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_own_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account(text) TO authenticated;

-- ══ SEC-013 · `notify_user` não deixava rastro ══════════════════════════════
--
-- A barreira de cargo estava certa e era só o que havia. Faltava: registro em
-- `admin_logs`, teto no texto, lista fechada no tipo, e conferir se o alvo
-- existe. Um admin mandava qualquer coisa para qualquer um sem trilha nenhuma —
-- contra toda a filosofia de auditoria deste projeto.
--
-- NÃO é XSS: conferido que não existe `dangerouslySetInnerHTML` no projeto, a
-- mensagem é texto. O que se fecha aqui é PRESTAÇÃO DE CONTAS.
--
-- A lista de tipos é fechada de propósito (§4, fallback silencioso): tipo
-- desconhecido chegava na tela e caía no mapa de ícones sem entrada.

CREATE OR REPLACE FUNCTION public.notify_user(p_user_id uuid, p_type text, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ator text;
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Access denied: admin required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  -- Faixa, e não só tipo (§5). O limite é de produto: notificação é aviso
  -- curto; texto longo é caso de mensagem de contato, que tem tela própria.
  IF p_message IS NULL OR length(btrim(p_message)) = 0 THEN
    RAISE EXCEPTION 'A notificacao precisa de uma mensagem.';
  END IF;
  IF length(p_message) > 500 THEN
    RAISE EXCEPTION 'A notificacao pode ter no maximo 500 caracteres.';
  END IF;

  IF p_type IS NULL OR p_type NOT IN
     ('warning','info','success','error','moderation','ban','unban','role','system') THEN
    RAISE EXCEPTION 'Tipo de notificacao desconhecido: %', coalesce(p_type, 'nulo');
  END IF;

  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, p_type, p_message);

  SELECT username INTO v_ator FROM profiles WHERE id = auth.uid();
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username,
                          severity, metadata, admin_id, admin_username)
  VALUES ('admin_notified_user',
          '@' || coalesce(v_ator, '?') || ' notificou @'
            || coalesce((SELECT username FROM profiles WHERE id = p_user_id), '?'),
          'admin', auth.uid(), v_ator, 'info',
          jsonb_build_object('target_id', p_user_id, 'type', p_type,
                             'message', left(p_message, 200)),
          auth.uid(), v_ator);
END $$;