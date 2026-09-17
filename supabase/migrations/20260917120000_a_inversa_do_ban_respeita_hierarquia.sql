-- ============================================================================
-- SEC-021 🟠 — a IDA compara cargo, a VOLTA não
-- ============================================================================
--
-- Pedido direto do dono, em 17/09: *"eu posso até colocar um super admin, mas
-- não quero que ele tenha poderes pra me desbanir"*.
--
-- ── A assimetria, medida no corpo das funções ───────────────────────────────
--
-- | Função | Compara com o cargo do ALVO? |
-- | --- | --- |
-- | `ban_user`         | **sim** — `role_rank(ator) <= role_rank(alvo)` recusa |
-- | `apply_suspension` | **sim** |
-- | `lift_suspension`  | **sim** |
-- | `unban_user`             | **NÃO** — só `IF NOT is_super()` |
-- | `approve_unban_request`  | **NÃO** — idem |
--
-- Resultado: um `super_admin` **não consegue banir** o `owner` e **consegue
-- desbanir**. A ida checa hierarquia e a volta não.
--
-- ── O detalhe que torna isto um bug, e não uma escolha ──────────────────────
--
-- A suspensão **já faz certo**: `apply_suspension` e `lift_suspension` são
-- simétricas, e as duas comparam cargo. Então o padrão correto não precisou ser
-- inventado aqui — ele já existia no projeto, e o desbanimento é que destoava
-- do próprio irmão. É deriva, não decisão.
--
-- ── Por que `is_super()` CONTINUA, e não foi substituído ────────────────────
--
-- A comparação de cargo sozinha deixaria um `admin` (rank 2) desbanir um `user`
-- (rank 1) — hoje ele não pode, e o dono não pediu para afrouxar isso. Então a
-- regra passa a ser **as duas coisas**: ser super_admin/owner **e** estar acima
-- do alvo.
--
-- ── O que isso fecha, e a contrapartida que ele aceitou ─────────────────────
--
-- | Quem | Desbana |
-- | --- | --- |
-- | `owner` (4) | super_admin, admin, user |
-- | `super_admin` (3) | admin, user — **nunca o owner, nunca outro super_admin** |
-- | `admin` (2) | ninguém (inalterado) |
--
-- **Se o próprio `owner` for banido, ninguém no site desfaz** — nem ele, porque
-- conta banida não entra. A recuperação é pelo banco, e ele já testou o
-- caminho: *"o processo não é difícil, só preciso lembrar os comandos"*. A
-- receita ficou escrita no `OPERACAO.md` justamente para não depender da
-- memória dele.
--
-- Isso deixa de ser buraco e passa a ser **decisão escrita**: o poder de
-- restaurar o fundador não é delegável pela interface.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller_id       uuid := auth.uid();
  v_caller_username text;
  v_caller_role     text;
  v_target_username text;
  v_target_banned   boolean;
  v_target_role     text;
BEGIN
  IF NOT is_super() THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;

  SELECT username, role INTO v_caller_username, v_caller_role
    FROM profiles WHERE id = v_caller_id;

  SELECT username, banned, role INTO v_target_username, v_target_banned, v_target_role
    FROM profiles WHERE id = p_user_id;
  IF v_target_username IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  -- SEC-021: a volta passa a comparar cargo, como a ida sempre fez.
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Acesso negado: nao e possivel desbanir cargo igual ou superior ao seu.';
  END IF;

  IF v_target_banned IS NOT TRUE THEN
    RAISE EXCEPTION 'Este usuario nao esta banido.';
  END IF;

  IF p_note IS NOT NULL AND length(p_note) > 500 THEN
    RAISE EXCEPTION 'A nota da equipe deve ter no maximo 500 caracteres.';
  END IF;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = p_user_id;

  -- `[17/09]` A mensagem parou de prometer o conteúdo de volta. O dono decidiu
  -- que o ban DESTROI ("a punição mais severa do site"), e dizer "sua conta
  -- voltou ao normal" para quem perdeu comentários, mural e chat é promessa
  -- que o sistema não cumpre (§1.5). A conta volta; o que foi apagado, não.
  INSERT INTO notifications (user_id, type, message)
  VALUES (p_user_id, 'unban',
    'Seu banimento foi revisto e removido: você já pode entrar e publicar de novo. '
      || 'O conteúdo apagado durante o banimento não é recuperado.'
      || COALESCE(' Nota da equipe: ' || p_note, ''));

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban',
    '@' || v_target_username || ' foi desbanido por @' || v_caller_username ||
      COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$fn$;


-- O mesmo guard no caminho do RECURSO. Aqui o alvo vem de `unban_requests`, e
-- sem a comparação um super_admin restauraria o fundador aprovando um pedido —
-- a mesma porta, com mais um passo.
CREATE OR REPLACE FUNCTION public.approve_unban_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_username text;
  v_caller_role text;
  v_target_role text;
  v_req unban_requests;
BEGIN
  IF NOT is_super() THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  SELECT username, role INTO v_caller_username, v_caller_role FROM profiles WHERE id = v_caller_id;

  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;

  SELECT role INTO v_target_role FROM profiles WHERE id = v_req.target_user_id;
  -- SEC-021, mesma regra do `unban_user`.
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Acesso negado: nao e possivel desbanir cargo igual ou superior ao seu.';
  END IF;

  UPDATE profiles
    SET banned = false, ban_reason = NULL, ban_details = NULL,
        banned_by = NULL, banned_by_username = NULL, banned_at = NULL
  WHERE id = v_req.target_user_id;

  UPDATE unban_requests
    SET status = 'approved', reviewed_by = v_caller_id,
        reviewed_by_username = v_caller_username, reviewed_at = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, type, message)
  VALUES (v_req.target_user_id, 'unban',
    'Seu pedido de revisão foi aceito: o banimento foi removido e você já pode entrar de novo. '
      || 'O conteúdo apagado durante o banimento não é recuperado.');

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
$fn$;
