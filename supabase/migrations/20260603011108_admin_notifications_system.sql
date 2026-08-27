CREATE TABLE admin_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL DEFAULT 'all_admins' CHECK (audience IN ('all_admins', 'super_admin')),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE admin_notification_reads (
  notification_id uuid REFERENCES admin_notifications(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  read_at timestamptz DEFAULT now(),
  PRIMARY KEY (notification_id, admin_id)
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_notifications" ON admin_notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

CREATE POLICY "admins_insert_reads" ON admin_notification_reads
  FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "admins_select_reads" ON admin_notification_reads
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

-- Trigger: novo usuário cadastrado → notifica todos os admins
CREATE OR REPLACE FUNCTION notify_admin_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, audience)
  VALUES ('new_user', 'Novo usuário', 'Um novo usuário se cadastrou: @' || NEW.username, 'all_admins');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_new_user
  AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION notify_admin_new_user();

-- Trigger: live criada → notifica todos os admins
CREATE OR REPLACE FUNCTION notify_admin_new_live()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_live = true AND (OLD IS NULL OR OLD.is_live = false) THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES ('new_live', 'Live iniciada',
            'Uma live foi iniciada: "' || NEW.title || '"',
            'all_admins',
            jsonb_build_object('post_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_new_live
  AFTER INSERT OR UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION notify_admin_new_live();

-- Trigger: solicitação de reativação → notifica super admins
CREATE OR REPLACE FUNCTION notify_admin_reactivation_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('reactivation_request', 'Solicitação de Reativação',
          NEW.admin_username || ' pediu para reativar "' || NEW.post_title || '"',
          'super_admin',
          jsonb_build_object('request_id', NEW.id, 'post_id', NEW.post_id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_reactivation_request
  AFTER INSERT ON live_reactivation_requests FOR EACH ROW EXECUTE FUNCTION notify_admin_reactivation_request();
;
