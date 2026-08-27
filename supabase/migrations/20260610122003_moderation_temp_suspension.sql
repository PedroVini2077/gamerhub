-- Coluna de suspensão temporária (NULL = não suspenso)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

-- Helper inline: bloqueia banido OU suspenso ativo
-- (aplicado nos WITH CHECK de INSERT de todo conteúdo)

DROP POLICY "posts_insert" ON posts;
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND NOT ((SELECT auth.uid()) IN (
    SELECT id FROM profiles WHERE banned = true OR (suspended_until IS NOT NULL AND suspended_until > now())
  ))
);

DROP POLICY "community_posts_insert" ON community_posts;
CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND NOT ((SELECT auth.uid()) IN (
    SELECT id FROM profiles WHERE banned = true OR (suspended_until IS NOT NULL AND suspended_until > now())
  ))
);

DROP POLICY "Auth insere comentario" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND NOT ((SELECT auth.uid()) IN (
    SELECT id FROM profiles WHERE banned = true OR (suspended_until IS NOT NULL AND suspended_until > now())
  ))
);

-- live_chat: antes só checava auth.uid()=user_id; agora bloqueia banido/suspenso
DROP POLICY "Auth envia mensagem" ON live_chat;
CREATE POLICY "live_chat_insert" ON live_chat FOR INSERT WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND NOT ((SELECT auth.uid()) IN (
    SELECT id FROM profiles WHERE banned = true OR (suspended_until IS NOT NULL AND suspended_until > now())
  ))
);

-- Função de suspensão (hierarquia igual ao ban_user)
CREATE OR REPLACE FUNCTION apply_suspension(p_user_id uuid, p_days int)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
  v_until timestamptz := now() + (p_days || ' days')::interval;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN
    RAISE EXCEPTION 'Access denied: cannot suspend equal or higher role';
  END IF;
  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_suspended',
    '@' || v_target_username || ' suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'security', auth.uid(), v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'days', p_days, 'until', v_until),
    auth.uid(), v_caller_username);
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_suspended', 'Usuário suspenso',
    '@' || v_target_username || ' foi suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username, 'days', p_days));
END;
$$;
REVOKE EXECUTE ON FUNCTION apply_suspension FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION apply_suspension TO authenticated;

-- Proteger suspended_until no trigger-guarda (cliente não auto-limpa)
CREATE OR REPLACE FUNCTION guard_profile_privileged_cols()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
begin
  if current_user in ('authenticated','anon') then
    new.role               := old.role;
    new.banned             := old.banned;
    new.ban_reason         := old.ban_reason;
    new.ban_details        := old.ban_details;
    new.banned_by          := old.banned_by;
    new.banned_by_username := old.banned_by_username;
    new.banned_at          := old.banned_at;
    new.ban_count          := old.ban_count;
    new.suspended_until    := old.suspended_until;
  end if;
  return new;
end;
$$;
;
