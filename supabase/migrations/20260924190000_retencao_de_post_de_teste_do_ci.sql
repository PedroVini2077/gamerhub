-- ============================================================================
-- `[24/09]` O CI publica post de VERDADE, e o soft delete os guardava para sempre
-- ============================================================================
--
-- O PROBLEMA, MEDIDO
-- ------------------
-- Cada execucao do E2E entra com conta descartavel real, publica, interage e
-- apaga. E o apagar do site e SOFT: a linha fica com `deleted_at` preenchido,
-- invisivel no feed e visivel para a equipe no painel.
--
-- Resultado em 24/09: `posts` tinha 410 linhas e TODAS as 410 eram de robo --
-- 409 apagadas a mao pelo dono neste mesmo dia (autores `claudestaff` e
-- `claudetester`, nenhuma conta de gente), e a ultima e esta migration.
--
-- Nao quebra nada e nao e segredo. E desperdicio e, sobretudo, RUIDO: e a
-- classe de "tabela append-only sem retencao" que o §6.1 ja lista para
-- `admin_logs` e `login_attempts`, e que ninguem tinha olhado em `posts`.
-- Qualquer medicao futura do feed -- tamanho de lote, custo de paginacao --
-- seria feita contra uma tabela de cadaver de teste.
--
-- POR QUE AQUI, E NAO NUM CRON NOVO
-- ---------------------------------
-- `cleanup_old_data()` ja existe, ja roda todo dia as 4h (`gamerhub-cleanup`)
-- e ja e o lugar da retencao das outras quatro tabelas. Criar um segundo
-- mecanismo para o mesmo trabalho seria a "espiral de controle" do §9.8.
--
-- O PADRAO E APERTADO DE PROPOSITO
-- --------------------------------
-- Nao e `title LIKE '[e2e %'`. E `^\[(e2e|painel|e2e-live) [0-9]{10,}\]`, que
-- exige o RELOGIO que o `marcaDeTeste` (e2e/publicarPost.mjs) escreve. Medido
-- em ROLLBACK antes de aplicar:
--
--   '[e2e coisas da vida] meu post'        -> NAO casa   (titulo de gente)
--   '[e2e 1790269082501] post automatico'  -> casa
--   '[e2e-live 1790269082501] live'        -> casa
--
-- Sem o relogio, alguem que escrevesse "[e2e ...]" num post de verdade e o
-- apagasse teria o post destruido 2h depois. Com ele, e preciso escrever 13
-- digitos de epoch para colidir -- e isso nao acontece por acidente.
--
-- E AS 2 HORAS
-- ------------
-- O detector de sobras do E2E usa 30 minutos (`IDADE_DE_SOBRA_MS`) porque o
-- job do painel roda EM PARALELO contra o mesmo banco. 2h e folga de 4x sobre
-- isso: nenhuma execucao em andamento perde o proprio post.
--
-- O QUE NAO E TOCADO
-- ------------------
-- `admin_logs`. A trilha registra o que aconteceu, e apagar o rastro do que o
-- robo fez seria mentir por omissao. Ela tem retencao propria de 365 dias.
-- `lives_realizadas` tambem nao: ela nao tem FK para `posts` de proposito
-- (LIVE-036), para o XP da live sobreviver ao cron que apaga o post.

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_logs bigint; v_notifs bigint; v_logins bigint; v_chat bigint; v_contatos bigint;
  v_posts_de_teste bigint;
BEGIN
  -- `[02/09]` 90 -> 365 dias. A trilha precisa sustentar uma decisão de
  -- moderação questionada meses depois; 90 dias não cobria um ban de janeiro
  -- discutido em maio. O número está espelhado em `LOG_RETENTION_DAYS`
  -- (`src/lib/logMeta.js`), e um teste falha se os dois divergirem.
  DELETE FROM admin_logs WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  -- Notificação já lida e velha não é mostrada em lugar nenhum.
  DELETE FROM notifications
   WHERE read = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_notifs = ROW_COUNT;

  -- Tentativas de login que não estão mais bloqueando ninguém. Bloqueio
  -- PERMANENTE nunca é apagado (é decisão de moderação, não lixo).
  DELETE FROM login_attempts
   WHERE permanent = false
     AND (blocked_until IS NULL OR blocked_until < now())
     AND updated_at < now() - interval '30 days';
  GET DIAGNOSTICS v_logins = ROW_COUNT;

  -- Chat de live já encerrada. A live em andamento nunca é tocada.
  DELETE FROM live_chat lc
   USING posts p
   WHERE p.id = lc.post_id
     AND p.is_live = false
     AND lc.created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_chat = ROW_COUNT;

  -- `[02/09]` A tabela nasceu em 02/09 sem prazo, e é a que guarda o dado mais
  -- sensível dos três: nome, e-mail e o relato de quem escreveu — inclusive de
  -- gente que não tem conta aqui.
  DELETE FROM contact_messages WHERE created_at < now() - interval '730 days';
  GET DIAGNOSTICS v_contatos = ROW_COUNT;

  -- `[24/09]` Post de TESTE que o CI publicou e já apagou (soft). Sem isto ele
  -- fica para sempre: eram 410 linhas, todas de robô, em menos de um mês.
  --
  -- O padrão exige o RELÓGIO da marca (`[prefixo <epoch>]`), não só o prefixo —
  -- um título de gente que comece com "[e2e " não casa. A lista de prefixos
  -- espelha `PREFIXOS_DE_TESTE` em `e2e/publicarPost.mjs`, e um teste de
  -- contrato reprova se as duas divergirem.
  --
  -- Só o que JÁ está soft-deletado: post de teste vivo é execução em curso, ou
  -- uma rodada que morreu no meio — e essa o detector de sobras precisa ver
  -- para acusar, senão o lixo some antes de alguém saber que houve falha.
  DELETE FROM posts
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - interval '2 hours'
     AND title ~ '^\[(e2e|painel|e2e-live) [0-9]{10,}\]';
  GET DIAGNOSTICS v_posts_de_teste = ROW_COUNT;

  RETURN jsonb_build_object(
    'admin_logs', v_logs,
    'notifications', v_notifs,
    'login_attempts', v_logins,
    'live_chat', v_chat,
    'contact_messages', v_contatos,
    'posts_de_teste', v_posts_de_teste
  );
END $function$;

COMMENT ON FUNCTION public.cleanup_old_data() IS
  'Retencao diaria (cron gamerhub-cleanup, 4h). `[24/09]` passou a apagar de '
  'verdade o post de TESTE que o CI ja soft-deletou ha mais de 2h — o padrao '
  'exige o relogio da marca, entao titulo de gente nao casa.';
