CREATE OR REPLACE FUNCTION notify_admin_new_live()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  actor_id   UUID;
BEGIN
  -- Tenta pegar o username de quem fez a ação via JWT
  BEGIN
    actor_id := (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
    SELECT username INTO actor_name FROM profiles WHERE id = actor_id;
  EXCEPTION WHEN OTHERS THEN
    actor_id   := NULL;
    actor_name := NULL;
  END;

  -- Live iniciada (INSERT com is_live = true)
  IF TG_OP = 'INSERT' AND NEW.is_live = true THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES (
      'new_live',
      'Live iniciada',
      '"' || NEW.title || '" foi iniciada' || COALESCE(' por ' || actor_name, ''),
      'all_admins',
      jsonb_build_object('post_id', NEW.id)
    );
  END IF;

  -- Live reativada (UPDATE: is_live false → true)
  IF TG_OP = 'UPDATE' AND OLD.is_live = false AND NEW.is_live = true THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES (
      'live_reactivated',
      'Live reativada',
      '"' || NEW.title || '" foi reativada' || COALESCE(' por ' || actor_name, ''),
      'all_admins',
      jsonb_build_object('post_id', NEW.id)
    );
  END IF;

  -- Live encerrada (UPDATE: is_live true → false)
  IF TG_OP = 'UPDATE' AND OLD.is_live = true AND NEW.is_live = false THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES (
      'live_ended',
      'Live encerrada',
      '"' || NEW.title || '" foi encerrada' || CASE
        WHEN actor_name IS NOT NULL THEN ' por ' || actor_name
        ELSE ' automaticamente'
      END,
      'all_admins',
      jsonb_build_object('post_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
