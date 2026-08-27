-- RPC para admin inserir notificação para um usuário (contorna a ausência de INSERT policy)
CREATE OR REPLACE FUNCTION notify_user(p_user_id uuid, p_type text, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Access denied: admin required';
  END IF;
  INSERT INTO notifications (user_id, type, message) VALUES (p_user_id, p_type, p_message);
END;
$$;
;
