-- 1. Expandir admin_logs com novos campos
ALTER TABLE admin_logs
  ADD COLUMN IF NOT EXISTS category  text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS actor_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_username text,
  ADD COLUMN IF NOT EXISTS severity  text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS metadata  jsonb;

-- Garantir índice para filtro por categoria
CREATE INDEX IF NOT EXISTS idx_admin_logs_category ON admin_logs(category);
CREATE INDEX IF NOT EXISTS idx_admin_logs_severity ON admin_logs(severity);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created  ON admin_logs(created_at DESC);

-- 2. RLS: admins podem SELECT em todos os logs
DROP POLICY IF EXISTS "admins_select_logs" ON admin_logs;
CREATE POLICY "admins_select_logs" ON admin_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin','super_admin')
    )
  );

-- 3. RPC para eventos autenticados (login, logout, ações admin)
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action   text,
  p_details  text,
  p_category text    DEFAULT 'auth',
  p_severity text    DEFAULT 'info',
  p_metadata jsonb   DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid;
  v_username text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
  END IF;

  INSERT INTO admin_logs (
    action, details, category, actor_id, actor_username,
    severity, metadata, admin_id, admin_username
  ) VALUES (
    p_action, p_details, p_category, v_uid,
    COALESCE(v_username, 'anônimo'),
    p_severity, p_metadata,
    v_uid, COALESCE(v_username, 'sistema')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

-- 4. RPC para eventos de segurança (acessível a anon — rate limiting, falhas de login)
CREATE OR REPLACE FUNCTION log_security_event(
  p_action   text,
  p_details  text,
  p_email    text  DEFAULT NULL,
  p_attempts int   DEFAULT 0,
  p_metadata jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_severity text;
BEGIN
  v_severity := CASE
    WHEN p_attempts >= 7 THEN 'critical'
    WHEN p_attempts >= 4 THEN 'warning'
    ELSE 'info'
  END;

  INSERT INTO admin_logs (
    action, details, category, actor_username,
    severity, metadata, admin_username
  ) VALUES (
    p_action, p_details, 'security',
    COALESCE(p_email, 'desconhecido'),
    v_severity,
    COALESCE(p_metadata, '{}'::jsonb)
      || jsonb_build_object('email', p_email, 'attempts', p_attempts),
    'sistema'
  );

  -- Notificação apenas nos limiares exatos para não spam
  IF p_attempts = 4 OR p_attempts = 7 THEN
    INSERT INTO admin_notifications (type, title, message, audience)
    VALUES (
      'security_alert',
      CASE WHEN p_attempts >= 7 THEN 'Conta bloqueada (24h)' ELSE 'Tentativas suspeitas' END,
      format(
        '%s tentativas falhas de login%s',
        p_attempts,
        CASE WHEN p_email IS NOT NULL THEN format(' para "%s"', p_email) ELSE '' END
      ),
      'all_admins'
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION log_security_event TO anon, authenticated;

-- 5. Atualizar notify_admin_new_user para também logar em admin_logs
CREATE OR REPLACE FUNCTION notify_admin_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, audience)
  VALUES (
    'new_user',
    'Novo usuário cadastrado',
    format('"%s" acabou de criar uma conta', NEW.username),
    'all_admins'
  );

  INSERT INTO admin_logs (
    action, details, category, actor_id, actor_username, severity, admin_username
  ) VALUES (
    'auth_register',
    format('Novo usuário registrado: @%s', NEW.username),
    'auth', NEW.id, NEW.username, 'info', 'sistema'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_user_admin_notify ON profiles;
CREATE TRIGGER on_new_user_admin_notify
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION notify_admin_new_user();

-- 6. Trigger de posts — loga criação, edição significativa e exclusão
CREATE OR REPLACE FUNCTION log_post_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid;
  v_username text;
  v_action   text;
  v_details  text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_uid := NEW.user_id;
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
    v_action  := 'content_post_created';
    v_details := format('Post "%s" criado por @%s (categoria: %s)',
      COALESCE(NEW.title,'sem título'), COALESCE(v_username,'?'), COALESCE(NEW.category,'geral'));
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES (v_action,v_details,'content',v_uid,COALESCE(v_username,'?'),'info','sistema',
      jsonb_build_object('post_id',NEW.id,'category',NEW.category));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Só loga se título ou conteúdo mudaram
    IF OLD.title IS NOT DISTINCT FROM NEW.title AND OLD.content IS NOT DISTINCT FROM NEW.content THEN
      RETURN NEW;
    END IF;
    v_uid := NEW.user_id;
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_edited',
      format('Post "%s" editado por @%s', COALESCE(NEW.title,'sem título'), COALESCE(v_username,'?')),
      'content',v_uid,COALESCE(v_username,'?'),'info','sistema',
      jsonb_build_object('post_id',NEW.id));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_uid := OLD.user_id;
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_deleted',
      format('Post "%s" excluído (autor: @%s)', COALESCE(OLD.title,'sem título'), COALESCE(v_username,'?')),
      'content',v_uid,COALESCE(v_username,'?'),'info','sistema',
      jsonb_build_object('post_id',OLD.id,'category',OLD.category));
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_post_event ON posts;
CREATE TRIGGER on_post_event
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION log_post_event();
;
