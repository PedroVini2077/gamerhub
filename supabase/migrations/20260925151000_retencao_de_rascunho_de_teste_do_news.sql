-- `[25/09]` A retenção passa a alcançar o RASCUNHO DE TESTE do News.
--
-- POR QUE ELA PRECISOU EXISTIR. O roteiro do painel passou a criar uma matéria
-- de verdade pelo navegador — é a única forma de provar que criar rascunho
-- funciona, depois do bug do `conteudo NOT NULL` que o dono achou.
--
-- Só que a conta do roteiro é `admin`, e **admin não apaga matéria** (o corte
-- editorial de hoje deixa apagar só para super admin e owner). Então o roteiro
-- não consegue limpar a própria sujeira — e sem isto ela se acumularia
-- exatamente como os 403 posts de robô que a gente apagou hoje de manhã.
--
-- A saída NÃO foi afrouxar a permissão: deixar admin apagar para o teste
-- funcionar seria mudar a regra de produto por causa da ferramenta. A saída é a
-- mesma dos posts — retenção com padrão exigente.
--
-- O padrão exige o RELÓGIO da marca (`[prefixo <epoch>]`), não só o prefixo:
-- um rascunho humano que comece com "[e2e " não casa. E só alcança `draft` e
-- `in_review` — matéria PUBLICADA nunca é tocada, mesmo com marca de teste,
-- porque apagar o que está no ar é decisão de gente.
--
-- PROVADO EM ROLLBACK, com quatro linhas de propósito:
--   [painel <epoch>] com 3h ....... APAGADO   (é o alvo)
--   [painel <epoch>] recém-criado . sobreviveu (execução em curso)
--   matéria publicada de verdade .. sobreviveu
--   rascunho humano sem marca ..... sobreviveu

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_logs bigint; v_notifs bigint; v_logins bigint; v_chat bigint; v_contatos bigint;
  v_posts_de_teste bigint; v_news_de_teste bigint;
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
  --
  -- As 2h são folga de 4x sobre o `IDADE_DE_SOBRA_MS` (30 min) do detector,
  -- que existe porque o job do painel roda EM PARALELO contra o mesmo banco.
  DELETE FROM posts
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - interval '2 hours'
     AND title ~ '^\[(e2e|painel|e2e-live) [0-9]{10,}\]';
  GET DIAGNOSTICS v_posts_de_teste = ROW_COUNT;

  -- `[25/09]` RASCUNHO de teste do News. O roteiro do painel cria uma matéria
  -- de verdade para provar que criar rascunho funciona — e a conta dele é
  -- `admin`, que **não apaga matéria** pelo corte editorial. Ou seja: ele não
  -- consegue limpar a própria sujeira, e sem isto ela se acumula como os 403
  -- posts de robô.
  --
  -- Nunca alcança `published` nem `scheduled`, mesmo com marca de teste:
  -- apagar o que está no ar é decisão de gente, não de faxina automática.
  DELETE FROM news_articles
   WHERE status IN ('draft','in_review')
     AND created_at < now() - interval '2 hours'
     AND titulo ~ '^\[(e2e|painel|e2e-live) [0-9]{10,}\]';
  GET DIAGNOSTICS v_news_de_teste = ROW_COUNT;

  RETURN jsonb_build_object(
    'admin_logs', v_logs,
    'notifications', v_notifs,
    'login_attempts', v_logins,
    'live_chat', v_chat,
    'contact_messages', v_contatos,
    'posts_de_teste', v_posts_de_teste,
    'news_de_teste', v_news_de_teste
  );
END $function$;
