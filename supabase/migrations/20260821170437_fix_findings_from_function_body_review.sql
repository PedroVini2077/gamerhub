-- ═══════════════════════════════════════════════════════════════════════════
-- Achados da LEITURA DO CORPO das funções SECURITY DEFINER (Fase 2 completa).
-- A varredura anterior olhou só os metadados (quem executa, tem search_path,
-- checa role) e deu essas 4 como seguras. Nenhuma delas seria pega sem ler o
-- código.
-- ═══════════════════════════════════════════════════════════════════════════

-- F1 (SEGURANÇA) — `check_staff_eligibility` não checava QUEM chama: qualquer
-- usuário logado passava o uuid de outra pessoa e recebia `ban_count`,
-- `currently_banned` e o motivo do bloqueio ('cooldown_6_meses',
-- 'multiplos_banimentos'). Ou seja, era um contorno parcial da restrição de
-- colunas de `profiles` aplicada logo antes. Só o próprio usuário ou admin+.
CREATE OR REPLACE FUNCTION public.check_staff_eligibility(p_user_id uuid, p_target_role text DEFAULT 'admin')
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_profile profiles%rowtype; v_xp int; v_account_age_days int;
  v_rank_ok boolean; v_ban_ok boolean; v_ban_reason text;
  v_admin_tenure_days int := null; v_tenure_ok boolean := true; v_eligible boolean;
begin
  if p_user_id <> auth.uid()
     and role_rank((select role from profiles where id = auth.uid())) < 2 then
    raise exception 'Acesso negado.';
  end if;
  if p_target_role not in ('admin','super_admin') then raise exception 'Cargo inválido: %', p_target_role; end if;
  select * into v_profile from profiles where id = p_user_id;
  if v_profile.id is null then raise exception 'Usuário não encontrado'; end if;
  v_account_age_days := floor(extract(epoch from now() - v_profile.created_at) / 86400);
  v_xp := coalesce((get_user_xp(p_user_id)->>'xp')::int, 0);
  v_rank_ok := v_xp >= 1000;
  if coalesce(v_profile.ban_count, 0) = 0 then v_ban_ok := true; v_ban_reason := null;
  elsif v_profile.ban_count = 1 then
    if v_profile.banned_at is not null and now() - v_profile.banned_at >= interval '6 months'
      then v_ban_ok := true; v_ban_reason := null;
      else v_ban_ok := false; v_ban_reason := 'cooldown_6_meses'; end if;
  else v_ban_ok := false; v_ban_reason := 'multiplos_banimentos'; end if;
  if p_target_role = 'super_admin' then
    if v_profile.role <> 'admin' then v_tenure_ok := false;
    else v_admin_tenure_days := floor(extract(epoch from now() - v_profile.role_changed_at) / 86400);
         v_tenure_ok := v_admin_tenure_days >= 365; end if;
  end if;
  v_eligible := (v_account_age_days >= 60) and v_rank_ok and v_ban_ok and v_tenure_ok
            and coalesce(v_profile.banned, false) = false;
  return jsonb_build_object('eligible',v_eligible,'target_role',p_target_role,
    'account_age_days',v_account_age_days,'account_age_ok',v_account_age_days >= 60,
    'xp',v_xp,'rank_ok',v_rank_ok,'ban_count',coalesce(v_profile.ban_count,0),
    'ban_ok',v_ban_ok,'ban_reason',v_ban_reason,
    'currently_banned',coalesce(v_profile.banned,false),
    'admin_tenure_days',v_admin_tenure_days,'tenure_ok',v_tenure_ok);
end;
$function$;

-- F2 (BUG DE PERMISSÃO) — `admin_unlock_login` exigia `role = 'super_admin'`
-- ESTRITO, então o FUNDADOR não conseguia desbloquear login nenhum. É a mesma
-- classe de bug que o backlog registra como já corrigida em
-- approve/deny_unban_request — esta passou batido. Agrava porque, se o dono
-- ficar bloqueado e for o único a poder agir, não há recuperação pelo app.
CREATE OR REPLACE FUNCTION public.admin_unlock_login(p_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 3 THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  UPDATE public.login_attempts
     SET blocked_until = NULL, permanent = false, updated_at = now()
   WHERE email = lower(trim(p_email));
END;
$function$;

-- F3 (HIERARQUIA) — `soft_delete_post` só checava `rank >= 2`, sem hierarquia:
-- um admin apagava post do super_admin ou do FUNDADOR. O delete definitivo já
-- respeitava `can_moderate_content` (a policy de DELETE), então o soft delete
-- era um contorno da regra "admin não modera quem está acima".
CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF (SELECT auth.uid()) <> v_owner AND NOT can_moderate_content(v_owner) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este post';
  END IF;
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id AND deleted_at IS NULL;
END;
$function$;

-- F4 — mesma hierarquia no restore (antes qualquer admin restaurava qualquer
-- post, inclusive desfazendo moderação de alguém acima dele).
CREATE OR REPLACE FUNCTION public.restore_post(p_post_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Post não encontrado'; END IF;
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Apenas admins podem restaurar posts';
  END IF;
  IF (SELECT auth.uid()) <> v_owner AND NOT can_moderate_content(v_owner) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este post';
  END IF;
  UPDATE posts SET deleted_at = null WHERE id = p_post_id;
END;
$function$;;
