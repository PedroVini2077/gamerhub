-- ============================================================================
-- SEC-016 — `role NOT IN (...)` NÃO BARRA NADA quando o papel é NULL
-- ============================================================================
--
-- ── O mecanismo, medido no banco (não deduzido) ─────────────────────────────
--
--     select (null::text not in ('super_admin','owner'));   -->  NULL
--
-- Em SQL, comparar com NULL não devolve `false`: devolve NULL. E `IF NULL THEN
-- ... END IF` **não dispara**. Então este guard, que parece negar a todo mundo
-- que não seja super_admin ou owner:
--
--     IF v_caller_role NOT IN ('super_admin','owner') THEN
--       RAISE EXCEPTION 'Access denied: super_admin required';
--     END IF;
--
-- ...deixa passar exatamente um caso: **quem não tem linha em `profiles`**. O
-- `SELECT role INTO v_caller_role` não acha nada, a variável fica NULL, e o
-- portão fica aberto.
--
-- ── Quatro funções, e a varredura foi de CLASSE (§1.3) ──────────────────────
--
-- `unban_user` · `approve_unban_request` · `deny_unban_request` ·
-- `notify_owner`. Todas as quatro têm o `NOT IN` como ÚNICO guard.
--
-- ── O que a prova em ROLLBACK mostrou, e ela corrigiu a minha hipótese ──────
--
-- Eu previ "o guard passa e o desbanimento acontece". Metade estava certa: o
-- guard passou, a função seguiu adiante, e o que a derrubou foi **outra coisa**
-- — um `NOT NULL` na coluna `admin_logs.admin_username`, que recebeu o nome do
-- chamador (NULL, porque ele não tem perfil).
--
-- Isso é §1.3 na letra: *"desconfiar de proteção acidental. Se algo só está
-- seguro por efeito colateral de outra regra, isso não é proteção — é sorte
-- esperando expirar"*. Duas coisas seguram hoje, e as duas são acidentais:
--
--   1. o `NOT NULL` de uma coluna de LOG, que não sabe que está fazendo
--      controle de acesso, e que qualquer migration futura pode afrouxar;
--   2. o fato de hoje existirem 0 usuários de auth sem perfil (medido) — um
--      invariante mantido pelo trigger `handle_new_user`, que vive FORA destas
--      funções e não é obrigação delas.
--
-- ── O conserto: `is_super()`, que é NULL-safe POR CONSTRUÇÃO ────────────────
--
--     role_rank(NULL)  -->  0        (medido; o CASE cai no ELSE)
--     is_super()       -->  0 >= 3   -->  false
--
-- `role_rank` mapeia papel desconhecido para 0, e 0 é o piso. Papel ausente
-- passa a NEGAR, que é a direção segura. É também a regra que o projeto já
-- tinha escrita — *"hierarquia nunca se escreve à mão"* — e que estas quatro
-- funções eram as últimas a violar.
--
-- `is_owner()` nasce aqui pelo mesmo motivo: ele faltava na família, e sem ele
-- a próxima checagem de `owner` voltaria a ser literal.
-- ============================================================================

-- ── O helper que faltava ────────────────────────────────────────────────────
-- Completa a família `is_staff` (>=2) / `is_super` (>=3). Mesma assinatura,
-- mesma volatilidade, mesmo `search_path` explícito — deliberadamente, para
-- que os três sejam intercambiáveis sem surpresa.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 4; $$;

REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

COMMENT ON FUNCTION public.is_owner() IS
  'Papel do chamador é owner (rank 4). NULL-safe: perfil ausente -> rank 0 -> false.';


-- ── 1/4 · unban_user ────────────────────────────────────────────────────────
--
-- Além do guard, dois buracos da mesma família aparecem aqui:
--
-- **O alvo pode não existir.** `SELECT username INTO v_target_username` sem
-- achar deixa a variável NULL, e `'@' || NULL || ' foi desbanido'` é **NULL
-- inteiro** (medido). A linha de auditoria nasceria sem história nenhuma, e a
-- `notifications` ganharia um destinatário que não existe.
--
-- **O alvo pode não estar banido.** Hoje a função aceita, escreve na trilha que
-- houve um desbanimento, e manda para a pessoa: *"Seu banimento foi revisto e
-- removido. Sua conta voltou ao normal."* — para alguém que nunca foi banida.
-- É a inversa sem a pergunta "o estado de ida existe?" (regra da INVERSA, §5).
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_caller_username text;
  v_target_username text;
  v_target_banned   boolean;
BEGIN
  -- `is_super()` no lugar de `NOT IN ('super_admin','owner')`: papel ausente
  -- vira rank 0, e 0 >= 3 é false. O portão fecha em vez de ficar NULL.
  IF NOT is_super() THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;

  SELECT username INTO v_caller_username FROM profiles WHERE id = v_caller_id;

  SELECT username, banned INTO v_target_username, v_target_banned
    FROM profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;
  IF NOT v_target_banned THEN
    RAISE EXCEPTION 'Este usuario nao esta banido.';
  END IF;

  IF p_note IS NOT NULL AND length(p_note) > 500 THEN
    RAISE EXCEPTION 'A nota da equipe deve ter no maximo 500 caracteres.';
  END IF;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = p_user_id;

  -- O aviso para a PESSOA. Sem isto o desbanimento é invisível para ela.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'unban',
    'Seu banimento foi revisto e removido. Sua conta voltou ao normal.'
      || COALESCE(' Nota da equipe: ' || p_note, ''));

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban',
    '@' || v_target_username || ' foi desbanido por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$$;


-- ── 2/4 · approve_unban_request ─────────────────────────────────────────────
-- Só o guard muda. O alvo aqui vem de `unban_requests`, que tem FK, então o
-- caso do alvo inexistente não se aplica.
CREATE OR REPLACE FUNCTION public.approve_unban_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_username text;
  v_req unban_requests;
BEGIN
  IF NOT is_super() THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT username INTO v_caller_username FROM profiles WHERE id = v_caller_id;

  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = v_req.target_user_id;

  UPDATE unban_requests
    SET status = 'approved', reviewed_by = v_caller_id,
        reviewed_by_username = v_caller_username, reviewed_at = now()
  WHERE id = p_request_id;

  -- Mesmo aviso do `unban_user`: quem recorreu precisa saber que ganhou o
  -- recurso, e a `BannedScreen` (onde ele acompanhava o caso) deixa de aparecer
  -- justamente por causa desta aprovação.
  INSERT INTO notifications (user_id, type, message)
  VALUES (v_req.target_user_id, 'unban',
    'Seu pedido de revisão foi aceito: o banimento foi removido e sua conta voltou ao normal.');

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_approved',
    'Super admin @' || v_caller_username || ' aprovou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')',
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username,
      'requesting_admin', v_req.requesting_admin_username),
    v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_approved', 'Desbanimento aprovado',
    '@' || v_req.target_username || ' foi desbanido pelo super admin.',
    'all_admins',
    jsonb_build_object('target_username', v_req.target_username));
END;
$$;


-- ── 3/4 · deny_unban_request ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deny_unban_request(p_request_id uuid, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_caller_id uuid := auth.uid(); v_caller_username text; v_req unban_requests;
BEGIN
  IF NOT is_super() THEN RAISE EXCEPTION 'Access denied: super_admin required'; END IF;
  SELECT username INTO v_caller_username FROM profiles WHERE id = v_caller_id;

  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  IF p_note IS NOT NULL AND length(p_note) > 500 THEN
    RAISE EXCEPTION 'A nota da equipe deve ter no maximo 500 caracteres.';
  END IF;

  UPDATE unban_requests SET status = 'denied', reviewed_by = v_caller_id,
    reviewed_by_username = v_caller_username, reviewed_at = now(), review_note = p_note
  WHERE id = p_request_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_denied',
    'Super admin @' || v_caller_username || ' negou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')' || COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username, 'note', p_note), v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_denied', 'Desbanimento negado',
    'O pedido de desbanimento de @' || v_req.target_username || ' (feito por @' ||
      v_req.requesting_admin_username || ') foi negado por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'all_admins', jsonb_build_object('target_username', v_req.target_username,
                                     'requesting_admin', v_req.requesting_admin_username,
                                     'note', p_note));
END;
$$;


-- ── 4/4 · notify_owner ──────────────────────────────────────────────────────
--
-- **Aqui houve MUDANÇA DE COMPORTAMENTO, e ela é deliberada.** O guard era
-- `v_role NOT IN ('admin','super_admin')`, que além do buraco de NULL excluía o
-- **owner** — ele recebia "Acesso negado" numa função de equipe.
--
-- `is_staff()` (rank >= 2) inclui o owner. É a correção do mesmo padrão que já
-- mordeu três vezes neste projeto: lista de papéis escrita à mão esquecendo o
-- `owner`, e 14 policies que precisaram ser varridas por causa disso.
--
-- O efeito prático é o owner poder mandar um alerta para a própria caixa. Sem
-- risco, e consistente com todo o resto do sistema, onde owner ⊇ super_admin.
CREATE OR REPLACE FUNCTION public.notify_owner(p_message text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username text;
  v_role     text;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT role, username INTO v_role, v_username FROM profiles WHERE id = auth.uid();

  IF length(trim(coalesce(p_message, ''))) < 10 THEN
    RAISE EXCEPTION 'Descreva o problema com pelo menos 10 caracteres.';
  END IF;
  -- Faixa que faltava: `text` aceita megabytes, e a caixa do owner é o alvo.
  IF length(trim(p_message)) > 2000 THEN
    RAISE EXCEPTION 'O alerta deve ter no maximo 2000 caracteres.';
  END IF;

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES (
    'staff_alert',
    'Alerta de @' || v_username,
    trim(p_message),
    'owner',
    jsonb_build_object('sender_id', auth.uid(), 'sender_username', v_username, 'sender_role', v_role)
  );
END;
$$;


-- ============================================================================
-- SEC-014 — `ban_user` aceita QUALQUER texto como motivo, e alvo inexistente
-- ============================================================================
--
-- O `BanModal` oferece **seis** motivos numa lista fechada. A RPC aceita
-- `text`. O site usa a `anon key`, então qualquer pessoa com conta de admin
-- chama a REST API direto e escreve o que quiser no motivo do ban — que é
-- texto que vai para a trilha de auditoria, para a `BannedScreen` da pessoa
-- banida e para a notificação de toda a equipe.
--
-- **A faixa é lista fechada, e ela cria uma DERIVA de propósito vigiada.** Se
-- alguém acrescentar um sétimo motivo no `BanModal` e esquecer daqui, o ban
-- falha **alto** (exceção -> toast), em vez de gravar um valor que os painéis
-- não sabem agrupar. E existe teste de contrato varrendo os dois lados.
--
-- **Alvo inexistente.** `SELECT username INTO v_target_username` sem achar
-- deixa NULL, e `'@' || NULL || ' foi banido'` é NULL inteiro (medido). Como
-- `admin_logs.details` é NULLABLE, isso GRAVA: a trilha ganha uma linha
-- `admin_ban` sem história nenhuma, enquanto o UPDATE afetou 0 linhas e
-- ninguém foi banido. Sucesso na tela, nada no banco, mentira no log (§1.5).
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text, p_details text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;

  IF role_rank(v_caller_role) <= 1 THEN
    RAISE EXCEPTION 'Access denied: admin required';
  END IF;

  -- Antes da hierarquia: sem alvo, `role_rank(NULL)` é 0 e a comparação
  -- passaria, deixando a função seguir para um UPDATE de 0 linhas.
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot ban equal or higher role';
  END IF;

  -- A FAIXA do motivo. A lista é a mesma do `BanModal.jsx`, e o teste de
  -- contrato `motivosDeBan.test.js` reprova se os dois lados divergirem.
  IF p_reason IS NULL OR p_reason NOT IN (
    'Spam / flood', 'Discurso de ódio', 'Comportamento abusivo',
    'Conteúdo impróprio', 'Trapaça / exploits', 'Outro'
  ) THEN
    RAISE EXCEPTION 'Motivo invalido: %. Use um dos motivos da lista.', coalesce(p_reason, '(vazio)');
  END IF;

  -- 300 é o `maxLength` do campo de detalhes no `BanModal`. Aqui ele passa a
  -- valer de verdade: validação no cliente não vale nada sozinha (§1.3).
  IF p_details IS NOT NULL AND length(p_details) > 300 THEN
    RAISE EXCEPTION 'Os detalhes devem ter no maximo 300 caracteres.';
  END IF;

  -- Bane o perfil e incrementa a reincidência
  UPDATE profiles
    SET banned = true, ban_reason = p_reason, ban_details = p_details,
        banned_by = v_caller_id, banned_by_username = v_caller_username,
        banned_at = now(), ban_count = ban_count + 1
  WHERE id = p_user_id;

  -- Remove TODA a atividade do usuário banido
  DELETE FROM posts           WHERE user_id = p_user_id;
  DELETE FROM comments        WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat       WHERE user_id = p_user_id;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_ban',
    '@' || v_target_username || ' foi banido por @' || v_caller_username || '. Motivo: ' || p_reason ||
      COALESCE(' — ' || p_details, ''),
    'security', v_caller_id, v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username,
      'reason', p_reason, 'details', p_details),
    v_caller_id, v_caller_username);

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_banned', 'Usuário banido',
    '@' || v_target_username || ' foi banido por @' || v_caller_username || '. Motivo: ' || p_reason,
    'all_admins',
    jsonb_build_object('target_username', v_target_username, 'reason', p_reason));
END;
$$;
