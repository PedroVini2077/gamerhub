-- apply_link_moderation: apenas authenticated (chamada pela Edge Function com JWT)
REVOKE EXECUTE ON FUNCTION apply_link_moderation(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION apply_link_moderation(text, uuid) TO authenticated;

-- apply_mod_auto_suspend: apenas chamada internamente por trigger SECURITY DEFINER
-- não precisa de acesso externo nenhum
REVOKE EXECUTE ON FUNCTION apply_mod_auto_suspend(uuid, integer) FROM PUBLIC, anon, authenticated;

-- notify_user: apenas authenticated (admin faz a chamada direto do cliente)
REVOKE EXECUTE ON FUNCTION notify_user(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION notify_user(uuid, text, text) TO authenticated;
;
