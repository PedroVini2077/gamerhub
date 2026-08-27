-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 2 da auditoria — endurecimento das funções SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════════════

-- P2-2 (ALTO) — `apply_ai_moderation` e `apply_link_moderation` estavam
-- liberadas para `authenticated` e não checam NADA sobre quem chama: elas
-- fazem `UPDATE ... SET hidden_at = now()` no conteúdo informado. Com a
-- moderação por IA ligada, qualquer usuário logado podia OCULTAR qualquer
-- post/comentário/mensagem do site — censura por qualquer um.
-- Comprovado em teste: um usuário comum ocultou um post do dono.
-- Só as Edge Functions (service role) precisam chamar isso.
REVOKE ALL ON FUNCTION public.apply_ai_moderation(text,uuid,double precision,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_link_moderation(text,uuid) FROM PUBLIC, anon, authenticated;

-- P2-3 (MÉDIO) — `record_banned_login_attempt` aceitava QUALQUER email e
-- gravava log + notificação de "conta banida tentou entrar". Dava pra poluir
-- a auditoria e disparar alerta falso sobre qualquer pessoa. Agora só aceita
-- o email da própria sessão — que é exatamente como o app usa (a chamada
-- acontece na sessão transitória do banido, antes do signOut).
CREATE OR REPLACE FUNCTION public.record_banned_login_attempt(p_email text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_email text := lower(trim(p_email)); v_username text; v_caller_email text;
BEGIN
  SELECT lower(email) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_caller_email IS NULL OR v_caller_email <> v_email THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT p.username INTO v_username
    FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE au.email = v_email;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auth_banned_attempt', 'Conta banida tentou fazer login: ' || COALESCE('@' || v_username, v_email),
    'security', NULL, 'sistema', 'warning',
    jsonb_build_object('email', v_email, 'username', v_username), NULL, 'sistema');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('banned_login_attempt', 'Tentativa de acesso de banido',
    'Uma conta banida' || COALESCE(' (@' || v_username || ')', '') || ' tentou fazer login.',
    'all_admins', jsonb_build_object('email', v_email, 'username', v_username));
END;
$function$;

-- P2-4 — dois triggers SECURITY DEFINER sem `search_path` fixo. Sem isso a
-- resolução de nomes depende do search_path de quem dispara o trigger, que é
-- o vetor clássico de escalada de privilégio em função definer.
ALTER FUNCTION public.handle_report_auto_hide()      SET search_path = public;
ALTER FUNCTION public.handle_violation_escalation()  SET search_path = public;

-- P2-5 (defesa em profundidade) — funções de staff/owner continuavam
-- executáveis por `anon`/PUBLIC. A checagem interna de role já barrava, mas o
-- projeto tem a convenção de revogar anon dessas rotas (ver BACKLOG) e estas
-- passaram batido. Todas são chamadas só por usuário logado.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.check_staff_eligibility(uuid,text)',
    'public.decide_role_demotion(uuid,text,text)',
    'public.decide_staff_trial(uuid,text,text,integer)',
    'public.nominate_staff(uuid,text)',
    'public.notify_owner(text)',
    'public.request_role_demotion(uuid,text,text)',
    'public.review_staff_nomination(uuid,text,text,integer)',
    'public.log_audit_event(text,text,text,text,jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;;
