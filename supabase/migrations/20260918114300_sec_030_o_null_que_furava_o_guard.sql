-- SEC-030 · `[18/09]` `record_banned_login_attempt(NULL)` furava o guard de
-- identidade e plantava linha FORJADA na trilha de seguranca.
--
-- **Esta e a causa dos logs sem titulo que o dono viu no painel.** Ele
-- perguntou "algum log nao esta sendo tratado corretamente, esta sem titulo
-- algum". Nao era formatacao: era uma linha que nunca deveria ter existido.
--
-- ── Como as duas coisas sao a mesma coisa ────────────────────────────────
--
-- O guard era:
--
--   IF v_caller_email IS NULL OR v_caller_email <> v_email THEN RAISE ...
--
-- Com `p_email = NULL`: `v_email` e NULL, `v_caller_email <> NULL` da **NULL**
-- (nao `true`), e `false OR NULL` da **NULL**. Um `IF NULL` **nao dispara**.
--
-- Esta exata armadilha ja esta escrita no `docs/regras/BANCO.md`, na secao
-- "Toda entrada de RPC precisa de FAIXA": *"`p_days IS NULL` passa por `< 1`?
-- Em SQL, nao — `NULL < 1` e NULL, e o IF nao dispara"*. A regra existia, o
-- guard foi escrito depois dela, e mesmo assim caiu no mesmo buraco. Por isso
-- este conserto sai com TESTE, e nao so com a linha corrigida.
--
-- E o titulo em branco cai por gravidade: o `details` e
--
--   'Conta banida tentou fazer login: ' || COALESCE('@'||v_username, v_email)
--
-- com `v_username` e `v_email` ambos NULL, `COALESCE` devolve NULL, e
-- **`texto || NULL` e NULL** em SQL. A linha nasce sem detalhe nenhum.
--
-- ── O estrago, medido ───────────────────────────────────────────────────
--
-- Provado em ROLLBACK com papel `authenticated` real:
--   . email de OUTRA pessoa .......... 'Acesso negado.'  (o guard funciona)
--   . NULL ........................... passou, e gravou 1 linha + 1 notificacao
--
-- E **sem teto**: a deduplicacao de 30 minutos casa por
-- `metadata->>'email' = v_email`, que com NULL vira `NULL = NULL` -> NULL ->
-- nunca casa. Entao CADA chamada cria linha nova E notificacao nova. Qualquer
-- pessoa logada podia encher a trilha de seguranca e o painel da equipe.
--
-- 🟠 Alto por dois motivos somados: a trilha existe para responder "o que
-- aconteceu e quem fez", e uma linha forjavel a faz **mentir por comissao**
-- (pior que a omissao — omissao deixa buraco, comissao escreve ficcao com cara
-- de fato); e o volume ilimitado e fadiga de alarme deliberada, a 4a regra do
-- §0.2.
--
-- ── A correcao ──────────────────────────────────────────────────────────
--
-- `p_email IS NULL` conferido EXPLICITAMENTE, antes de qualquer comparacao. Nao
-- da para consertar isso "melhorando" o `<>`: em SQL nada comparado com NULL da
-- true, entao a unica defesa e perguntar por NULL primeiro.
--
-- As duas linhas ja plantadas (18/09 02:09 UTC) ficam onde estao, de proposito:
-- apagar linha de trilha de auditoria e exatamente o que um atacante quer, e
-- nao vale abrir esse precedente por duas linhas de teste. O painel passa a
-- exibi-las de forma legivel — ver `LogsPanel.jsx`.

CREATE OR REPLACE FUNCTION public.record_banned_login_attempt(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_email        text := lower(trim(p_email));
  v_username     text;
  v_caller_email text;
  v_recente      uuid;
  v_vezes        int;
BEGIN
  -- `p_email IS NULL` PRIMEIRO e explicito. Sem esta linha, `v_caller_email <>
  -- NULL` devolve NULL, `false OR NULL` devolve NULL, e o IF nao dispara —
  -- era por aqui que se plantava log forjado sem limite.
  IF p_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT lower(email) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_caller_email IS NULL OR v_caller_email <> v_email THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT p.username INTO v_username
    FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE au.email = v_email;

  SELECT id, COALESCE((metadata->>'vezes')::int, 1)
    INTO v_recente, v_vezes
    FROM admin_logs
   WHERE action = 'auth_banned_attempt'
     AND metadata->>'email' = v_email
     AND created_at > now() - interval '30 minutes'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_recente IS NOT NULL THEN
    UPDATE admin_logs
       SET metadata = metadata || jsonb_build_object('vezes', v_vezes + 1, 'ultima_em', now()),
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

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('banned_login_attempt', 'Tentativa de acesso de banido',
    'Uma conta banida' || COALESCE(' (@' || v_username || ')', '') || ' tentou fazer login.',
    'all_admins', jsonb_build_object('email', v_email, 'username', v_username));
END;
$fn$;
