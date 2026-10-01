-- `[01/10]` O rascunho de teste do News ganha relógio próprio.
--
-- O defeito não era o mecanismo, era a FREQUÊNCIA. O `cleanup_old_data()` já
-- apagava isto desde 25/09 e a regra estava certa — mas ele roda UMA VEZ POR
-- DIA, às 04:00 UTC, e o `painel-admin.mjs` cria uma matéria A CADA RODADA DE
-- CI. Medido em 01/10, quando o dono reclamou da tela: três rascunhos no
-- painel com 12 min, 20 min e 1 h, todos `in_review`. Só sumiriam 17 h depois.
--
-- É o §1.5 numa roupa diferente: o mecanismo existe, funciona, e não chega em
-- forma utilizável. E eles entram na FILA EDITORIAL de verdade, que é onde uma
-- pessoa decide o que vai ao ar.
--
-- POR QUE FUNÇÃO SEPARADA e não só mudar o cron: o `cleanup_old_data()` carrega
-- a retenção de `admin_logs` (365 dias) e `contact_messages` (730 dias). Rodar
-- aquele lote de 10 em 10 min seria varrer anos de tabela para apagar uma linha
-- de robô.
--
-- POR QUE 15 MINUTOS, se o post de teste usa 2 HORAS: a janela dos posts não é
-- folga de segurança — ela existe para o DETECTOR DE SOBRAS ver o lixo de uma
-- rodada que morreu e acusar. No News não há detector e não pode haver: a
-- matéria SEMPRE fica, porque a conta do CI é `admin` e `news_articles_delete`
-- exige `is_super()`. Sobra aqui nunca foi sinal de falha, é o funcionamento
-- normal. Então a janela só protege uma rodada EM CURSO — e entre criar o
-- rascunho e mandar para revisão passam segundos. 15 min são ~7x o roteiro.
--
-- Testado em ROLLBACK antes de aplicar: apaga a sobra velha, NÃO toca na
-- recém-criada (rodada em curso), e NÃO toca em matéria de gente com título
-- parecido ("[e2e coisas da vida] …", 9 dias de idade).
--
-- A regra EQUIVALENTE continua em `cleanup_old_data()` como rede diária. As
-- duas são cobertas pelo mesmo teste de contrato (`retencaoDePostDeTeste`),
-- que é o que impede a divergência do §4 — foi o que aconteceu com o
-- `[e2e-live `, que nasceu depois dos outros dois.

CREATE OR REPLACE FUNCTION public.limpar_rascunhos_de_teste_do_news()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v integer;
BEGIN
  -- Nunca alcança `published` nem `scheduled`, mesmo com marca de teste:
  -- tirar do ar é decisão de gente, não de faxina automática.
  --
  -- O padrão exige o RELÓGIO da marca (`[prefixo <epoch>]`), não só o prefixo.
  -- Sem ele, uma matéria de gente chamada "[e2e coisas da vida] …" seria
  -- destruída. Espelha `PREFIXOS_DE_TESTE` em `e2e/publicarPost.mjs`.
  DELETE FROM news_articles
   WHERE status IN ('draft','in_review')
     AND created_at < now() - interval '15 minutes'
     AND titulo ~ '^\[(e2e|painel|e2e-live) [0-9]{10,}\]';
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN v;
END $fn$;

-- Só o cron chama. Nenhuma tela precisa disto, e função de faxina aberta a
-- `authenticated` é apagar linha de graça para quem tiver uma conta.
REVOKE ALL ON FUNCTION public.limpar_rascunhos_de_teste_do_news() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.limpar_rascunhos_de_teste_do_news() IS
  'Apaga rascunho/em-revisao de teste do News com mais de 15 min. Roda de 10 em '
  '10 min pelo cron gamerhub-limpa-news-de-teste. A conta do CI e admin e nao '
  'pode apagar materia (is_super), entao a sobra e por construcao.';

SELECT cron.schedule(
  'gamerhub-limpa-news-de-teste',
  '*/10 * * * *',
  $cron$SELECT public.limpar_rascunhos_de_teste_do_news();$cron$
);
