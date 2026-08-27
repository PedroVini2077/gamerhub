-- P3-3 — `guard_profile_privileged_cols` é justamente o guard que impede
-- auto-promoção a owner e auto-desbanimento, e estava SEM `search_path` fixo.
-- Uma função definer sem search_path resolve nomes conforme o search_path de
-- quem dispara — o vetor clássico pra sequestrar a resolução e neutralizar o
-- próprio guard.
ALTER FUNCTION public.guard_profile_privileged_cols() SET search_path = public;

-- P3-4 (defesa em profundidade) — funções de TRIGGER estavam com EXECUTE
-- aberto pra `anon`/`authenticated`. Não são exploráveis por RPC (dependem de
-- contexto de trigger), mas não há motivo nenhum pra estarem expostas.
-- O disparo por trigger NÃO depende de EXECUTE: o Postgres checa esse
-- privilégio na criação do trigger, não a cada disparo — verificado em teste
-- (post criado por usuário comum continuou gerando o log do trigger, e o
-- cadastro continuou criando o profile).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.handle_report_auto_hide()',
    'public.handle_user_confirmed()',
    'public.handle_violation_escalation()',
    'public.log_post_event()',
    'public.notify_admin_new_live()',
    'public.notify_admin_new_user()',
    'public.notify_admin_reactivation_request()',
    'public.notify_comment_like()',
    'public.notify_post_comment()',
    'public.notify_post_like()',
    'public.guard_profile_privileged_cols()',
    'public.guard_post_privileged_cols()',
    'public.set_live_ended_at()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;;
