-- `[25/09]` A matéria diz se foi RASCUNHADA por IA.
--
-- O dono aprovou IA no News com a condição de que nada sai sozinho: passa pela
-- administração e por ele. Isso cobre o risco de publicar errado — não cobre o
-- de **esquecer**. Daqui a três meses, olhando uma matéria, ninguém tem como
-- saber se o texto nasceu de um modelo ou da mão de alguém.
--
-- Importa por dois motivos práticos:
--
--   revisão   matéria rascunhada por IA merece leitura mais desconfiada, e o
--             revisor precisa saber ANTES de ler, não depois
--   histórico se um erro aparecer publicado, a primeira pergunta vai ser
--             "isso veio de IA?" — e hoje não haveria resposta
--
-- É AUTODECLARADO, e isto está escrito de propósito: quem marca é o painel,
-- quando o editor aplica o rascunho gerado. Ninguém é obrigado pelo banco. A
-- coluna serve à procedência honesta, não a fiscalizar quem queira esconder —
-- para isso o caminho seria registrar cada geração na trilha, e está no
-- BACKLOG como item próprio.
--
-- `DEFAULT false` e `NOT NULL`: matéria antiga e matéria escrita à mão nascem
-- corretamente marcadas como "não foi IA", sem nulo ambíguo no meio.
--
-- Provado em ROLLBACK: admin cria marcado, a marca persiste, e as existentes
-- ficam em `false`.

ALTER TABLE news_articles
  ADD COLUMN redigido_com_ia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN news_articles.redigido_com_ia IS
  'O rascunho saiu da Edge Function `redigir-materia`. Autodeclarado pelo painel '
  'quando o editor aplica o texto gerado — serve a procedencia, nao a fiscalizacao.';
