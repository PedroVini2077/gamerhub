-- ============================================================================
-- RETENÇÃO HÍBRIDA — tempo E quantidade
-- ============================================================================
--
-- Pedido do dono em 01/10, 🟠 do `BACKLOG.md`.
--
-- ## O que o prazo sozinho NÃO promete
--
-- `cleanup_old_data()` apagava por TEMPO desde 02/09. Isso promete que nada
-- vive mais de 365 dias — e **não** promete quantas linhas cabem nesses 365
-- dias. São duas garantias diferentes, e só a segunda limita o tamanho.
--
-- Medido em 02/10, nos últimos 30 dias de `admin_logs`:
--
--     média        139 linhas/dia      -> ~50.700 no ano
--     pico         924 linhas num dia  -> ~337.000 no ano, se virasse rotina
--     hoje         4.994 linhas (desde 04/06)
--
-- O teto existe para o segundo cenário. **Ele é backstop, não corte:** 80.000
-- é 1,6x a projeção medida, então em operação normal ele apaga ZERO.
--
-- ## A MARGEM DE LIMPEZA — restrição dele, e ela não é detalhe
--
-- *"Deixar passar do teto e só então voltar a ele, em vez de limpar a cada
-- pequeno excesso."* Sem margem, o corte roda TODA noite assim que a tabela
-- encosta no teto — algumas linhas por vez, para sempre, cada uma disparando
-- o aviso do §1.5 até ele virar ruído (§0.2, 4ª regra).
--
-- A margem é **125% do teto, derivada**, não um segundo parâmetro: dois
-- números independentes divergem, e a margem só faz sentido em relação ao
-- teto. Com 80.000 ela é 100.000 — o corte tira 20.000 de uma vez e só volta
-- a acontecer uns 144 dias depois, no ritmo medido.
--
-- Vale igual para o teto POR USUÁRIO: quem vive em 501 notificações não perde
-- uma por noite; ele só é cortado ao passar de 625.
--
-- ## As três regras, e por que cada uma tem a forma que tem
--
-- | alvo | tempo | quantidade | por quê |
-- | --- | --- | --- | --- |
-- | `admin_logs` | 365d (já existia) | **80.000** | 1,6x a projeção medida |
-- | `admin_notifications` | **365d (nova)** | **20.000** | não tinha prazo NENHUM |
-- | `notifications` | lida + 30d (já existia) | **500 POR USUÁRIO** | teto global faria o movimentado apagar o do quieto |
--
-- `admin_notifications` ganha o mesmo prazo da trilha porque as duas aparecem
-- na **mesma lista** do painel do fundador — prazos diferentes deixariam um
-- buraco no meio dela. Ela cresce devagar (~2,5 linhas/dia), e é exatamente
-- por isso que passou despercebida: tabela que incomoda avisa sozinha.
--
-- ## O teto que corta precisa GRITAR (§1.5)
--
-- Se o teto apagar alguma coisa, a trilha deixou de cobrir os 365 dias que o
-- painel anuncia — e isso é informação, não rotina. Uma linha em `admin_logs`
-- com `action = 'retencao_teto_atingido'` e `severity = 'warning'` diz quantas
-- linhas cada alvo perdeu.
--
-- A linha entra DEPOIS do teto, então fica 1 acima dele até a madrugada
-- seguinte. É deliberado: apagar o aviso para respeitar o número exato seria
-- apagar justamente a explicação do corte.
--
-- ## Por que DUAS funções auxiliares, e não tudo inline
--
-- Porque teto inline não se testa. Provar que o corte respeita o teto exigiria
-- fabricar 80.000 linhas; com `aplicar_teto_de_linhas('admin_logs', 10)` o
-- mesmo caminho de código se prova em ROLLBACK com as linhas que já existem.
--
-- Medido em ROLLBACK antes de ligar (§5):
--
--     admin_logs: 4.996 -> teto 10 -> apagou 4.986, sobraram 10   OK
--     e sobrou o mais NOVO, não o mais velho                      OK
--     tabela fora do mapa                                         recusada
--     teto 0 e teto NULL                                          recusados
--     por usuário: A tinha 7 -> 3; B tinha 2 -> 2 (intacto)       OK
--
-- ## O nome da tabela é MAPA FECHADO, não parâmetro dinâmico
--
-- `format('%I')` impediria injeção e **não** impediria apontar a faxina para a
-- tabela errada — que é o estrago que importa aqui. O `ELSE` levanta exceção
-- em vez de escolher um alvo (§4, fallback silencioso é proibido).
--
-- ## A faixa, não só o tipo
--
-- `p_teto integer` aceita `0` e `NULL`. `NULL < 1` em SQL é `NULL`, e o `IF`
-- não dispararia — por isso o `IS NULL` explícito. É o mesmo gotcha que fez
-- uma suspensão de "alguns dias" virar o ano 2126.
-- ============================================================================

-- ─── O teto por TABELA ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_teto_de_linhas(p_tabela text, p_teto integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_apagadas bigint; v_margem bigint; v_tem bigint;
BEGIN
  IF p_teto IS NULL OR p_teto < 1 THEN
    RAISE EXCEPTION 'Teto de linhas invalido: %. Precisa ser um inteiro >= 1.', p_teto;
  END IF;

  -- A MARGEM DE LIMPEZA, pedida por ele: "deixar passar do teto e so entao
  -- voltar a ele, em vez de limpar a cada pequeno excesso". Sem ela o corte
  -- roda TODA noite assim que a tabela encosta no teto — algumas linhas por
  -- vez, para sempre, e cada uma delas disparando o aviso do §1.5 ate ele
  -- virar ruido (§0.2, 4a regra).
  --
  -- 125% do teto, DERIVADO e nao um segundo parametro: dois numeros
  -- independentes divergem, e a margem so faz sentido em relacao ao teto.
  -- Com 80.000 a margem e 100.000 — o corte tira 20.000 de uma vez e so volta
  -- a acontecer uns 144 dias depois, no ritmo medido de 139 linhas/dia.
  v_margem := ceil(p_teto * 1.25);

  IF p_tabela = 'admin_logs' THEN
    SELECT count(*) INTO v_tem FROM admin_logs;
  ELSIF p_tabela = 'admin_notifications' THEN
    SELECT count(*) INTO v_tem FROM admin_notifications;
  ELSE
    RAISE EXCEPTION 'Tabela fora do mapa de retencao: %. O mapa e FECHADO (admin_logs, admin_notifications).', p_tabela;
  END IF;

  IF v_tem <= v_margem THEN
    RETURN 0;
  END IF;

  IF p_tabela = 'admin_logs' THEN
    DELETE FROM admin_logs WHERE id IN (
      SELECT id FROM admin_logs ORDER BY created_at DESC, id DESC OFFSET p_teto);
  ELSIF p_tabela = 'admin_notifications' THEN
    DELETE FROM admin_notifications WHERE id IN (
      SELECT id FROM admin_notifications ORDER BY created_at DESC, id DESC OFFSET p_teto);
  ELSE
    RAISE EXCEPTION 'Tabela fora do mapa de retencao: %. O mapa e FECHADO (admin_logs, admin_notifications).', p_tabela;
  END IF;

  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas;
END $fn$;

REVOKE ALL ON FUNCTION public.aplicar_teto_de_linhas(text, integer) FROM PUBLIC, anon, authenticated;

-- ─── O teto POR USUÁRIO ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_teto_por_usuario(p_teto integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_apagadas bigint;
BEGIN
  IF p_teto IS NULL OR p_teto < 1 THEN
    RAISE EXCEPTION 'Teto por usuario invalido: %. Precisa ser um inteiro >= 1.', p_teto;
  END IF;

  -- Mesma margem de 125% do teto por tabela, pela mesma razao: sem ela, quem
  -- vive em 501 notificacoes tem uma apagada toda noite, para sempre.
  WITH excedente AS (
    SELECT id FROM (
      SELECT id,
             row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS pos,
             count(*)     OVER (PARTITION BY user_id) AS total
        FROM notifications) t
     WHERE t.total > ceil(p_teto * 1.25) AND t.pos > p_teto)
  DELETE FROM notifications WHERE id IN (SELECT id FROM excedente);

  GET DIAGNOSTICS v_apagadas = ROW_COUNT;
  RETURN v_apagadas;
END $fn$;

REVOKE ALL ON FUNCTION public.aplicar_teto_por_usuario(integer) FROM PUBLIC, anon, authenticated;

-- O único índice que faltava para os tetos. `admin_logs` e `notifications` já
-- tinham o seu; `admin_notifications` só tinha a PK, e o teto ordena por
-- `created_at`.
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
  ON public.admin_notifications USING btree (created_at DESC);

-- ─── A faxina noturna, agora com as duas dimensões ──────────────────────────
-- Só as três linhas de teto e o bloco de aviso são novos; o resto é o corpo
-- de 25/09 inalterado, repetido porque `CREATE OR REPLACE` exige o todo.
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_logs bigint; v_notifs bigint; v_logins bigint; v_chat bigint; v_contatos bigint;
  v_posts_de_teste bigint; v_news_de_teste bigint;
  v_notifs_admin bigint;
  v_teto_logs bigint; v_teto_notifs_admin bigint; v_teto_por_usuario bigint;
BEGIN
  -- `[02/09]` 90 -> 365 dias. A trilha precisa sustentar uma decisão de
  -- moderação questionada meses depois. Espelhado em `LOG_RETENTION_DAYS`
  -- (`src/lib/logMeta.js`), com teste que falha se os dois divergirem.
  DELETE FROM admin_logs WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  -- Notificação já lida e velha não é mostrada em lugar nenhum.
  DELETE FROM notifications
   WHERE read = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_notifs = ROW_COUNT;

  -- `[02/10]` A tabela do painel da EQUIPE não tinha prazo nenhum, e é a mais
  -- fácil de esquecer porque cresce devagar (~2,5 linhas/dia). Mesmo prazo da
  -- trilha: as duas aparecem na MESMA lista do painel do fundador.
  DELETE FROM admin_notifications WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS v_notifs_admin = ROW_COUNT;

  -- Tentativas que não bloqueiam mais ninguém. Bloqueio PERMANENTE nunca é
  -- apagado (é decisão de moderação, não lixo).
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

  -- `[02/09]` O dado mais sensível dos três: nome, e-mail e o relato de quem
  -- escreveu — inclusive de gente que não tem conta aqui.
  DELETE FROM contact_messages WHERE created_at < now() - interval '730 days';
  GET DIAGNOSTICS v_contatos = ROW_COUNT;

  -- `[24/09]` Post de TESTE que o CI publicou e já apagou (soft). O padrão
  -- exige o RELÓGIO da marca, não só o prefixo. Só o que JÁ está soft-deletado:
  -- post de teste vivo é execução em curso, e o detector de sobras precisa
  -- vê-lo para acusar.
  DELETE FROM posts
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - interval '2 hours'
     AND title ~ '^\[(e2e|painel|e2e-live) [0-9]{10,}\]';
  GET DIAGNOSTICS v_posts_de_teste = ROW_COUNT;

  -- `[25/09]` RASCUNHO de teste do News. A conta do roteiro é `admin`, que não
  -- apaga matéria pelo corte editorial — ela não consegue limpar a própria
  -- sujeira. Nunca alcança `published` nem `scheduled`.
  DELETE FROM news_articles
   WHERE status IN ('draft','in_review')
     AND created_at < now() - interval '2 hours'
     AND titulo ~ '^\[(e2e|painel|e2e-live) [0-9]{10,}\]';
  GET DIAGNOSTICS v_news_de_teste = ROW_COUNT;

  -- ── `[02/10]` A dimensão nova: QUANTIDADE, depois de TEMPO ───────────────
  -- O prazo roda antes porque é barato e tira o grosso; o teto só vê o que
  -- sobrou. Backstop: 80.000 é 1,6x a projeção medida de 50.700/ano.
  v_teto_logs         := public.aplicar_teto_de_linhas('admin_logs', 80000);
  v_teto_notifs_admin := public.aplicar_teto_de_linhas('admin_notifications', 20000);
  -- Por USUÁRIO: teto global faria o movimentado apagar o do quieto.
  v_teto_por_usuario  := public.aplicar_teto_por_usuario(500);

  -- §1.5 — teto cortando é a faxina funcionando E uma notícia ruim: a trilha
  -- deixou de cobrir o prazo que o painel anuncia.
  IF (v_teto_logs + v_teto_notifs_admin + v_teto_por_usuario) > 0 THEN
    INSERT INTO admin_logs (admin_username, action, category, severity, details)
    VALUES ('sistema', 'retencao_teto_atingido', 'system', 'warning',
      format('Teto de quantidade cortou linhas que o prazo de 365 dias ainda cobria - trilha %s, avisos da equipe %s, notificacoes de usuario %s.',
             v_teto_logs, v_teto_notifs_admin, v_teto_por_usuario));
  END IF;

  RETURN jsonb_build_object(
    'admin_logs', v_logs,
    'notifications', v_notifs,
    'admin_notifications', v_notifs_admin,
    'login_attempts', v_logins,
    'live_chat', v_chat,
    'contact_messages', v_contatos,
    'posts_de_teste', v_posts_de_teste,
    'news_de_teste', v_news_de_teste,
    'teto_admin_logs', v_teto_logs,
    'teto_admin_notifications', v_teto_notifs_admin,
    'teto_notifications_por_usuario', v_teto_por_usuario
  );
END $function$;
