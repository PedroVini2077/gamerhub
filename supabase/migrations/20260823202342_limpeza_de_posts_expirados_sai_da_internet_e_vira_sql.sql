-- Por que esta migration existe
-- ------------------------------
-- A Edge Function `cleanup-expired-posts` estava com `verify_jwt: false`, sem
-- nenhuma checagem no corpo, rodando com `SUPABASE_SERVICE_ROLE_KEY` e
-- apagando linhas de `posts`. Qualquer pessoa da internet disparava.
--
-- O estrago em DADOS é nulo: ela é idempotente e só apaga o que o próprio
-- agendamento apagaria de qualquer jeito. O estrago real é outro — cada
-- chamada roda duas varreduras de DELETE em `posts`, então dá para martelar
-- de fora e consumir invocação de Edge Function (cota do plano) e carga de
-- banco de graça. E a resposta ainda contava quantas linhas saíram.
--
-- Guardar a porta exigiria um segredo compartilhado entre o `pg_cron` e a
-- função (o cron chama por `pg_net` SEM cabeçalho nenhum hoje). Mas o trabalho
-- dela é SQL puro: dois DELETEs. A correção certa não é trancar a porta — é
-- não ter porta. Vira função no banco, o cron passa a chamá-la direto, e a
-- Edge Function deixa de ter razão de existir.
--
-- Bônus: o `expire-lives` (jobid 4) já faz DELETE em `posts` direto do cron,
-- então isto é o padrão da casa, não invenção nova.

CREATE OR REPLACE FUNCTION public.cleanup_expired_posts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expirados bigint;
  v_purgados  bigint;
BEGIN
  -- 1. Lives cujo prazo passou. `expires_at IS NULL` = post normal, nunca some.
  DELETE FROM posts
   WHERE expires_at IS NOT NULL
     AND expires_at < now();
  GET DIAGNOSTICS v_expirados = ROW_COUNT;

  -- 2. Purga definitiva do que foi soft-deletado há mais de 30 dias. A janela
  --    existe para o admin conseguir restaurar; passado isso, é lixo.
  --    O trigger AFTER DELETE de `posts` é quem tira esses itens da fila de
  --    moderação e das denúncias — por isso o DELETE aqui, e não um TRUNCATE
  --    ou um caminho que pule os triggers.
  DELETE FROM posts
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS v_purgados = ROW_COUNT;

  RETURN jsonb_build_object(
    'expirados_apagados', v_expirados,
    'soft_deletados_purgados', v_purgados
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_posts IS
  'Faxina horária de posts (cron jobid 1). Substitui a Edge Function '
  'cleanup-expired-posts, que era chamável por qualquer um da internet.';

-- Ninguém de fora chama isto: é manutenção agendada. O `postgres` executa o
-- cron, e o dono ainda consegue rodar na mão pelo SQL editor.
REVOKE ALL ON FUNCTION public.cleanup_expired_posts() FROM PUBLIC, anon, authenticated;

-- O cron passa a chamar o banco direto, em vez de dar a volta pela internet
-- via pg_net -> Edge Function -> service_role -> banco.
SELECT cron.alter_job(
  job_id  := 1,
  command := 'SELECT public.cleanup_expired_posts();'
);;
