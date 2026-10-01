-- `[01/10]` A busca ampla do radar troca de fornecedor: GDELT -> Google News.
--
-- DECISÃO DELE, depois do diagnóstico. A GDELT foi desligada no mesmo dia
-- (`DECISOES.md`): sete tentativas, dois IPs, zero sucessos. O teto de 1
-- requisição a cada 5 s é POR IP, e tanto o ambiente de desenvolvimento
-- quanto a Edge Function da Supabase saem de IP compartilhado — o orçamento
-- já está gasto por terceiros antes de nós chegarmos.
--
-- POR QUE ISTO NÃO PRECISA DE UMA LINHA DE CÓDIGO
--
-- O Google News publica a busca como **RSS 2.0**, e o coletor de RSS já
-- existe desde a fundação do radar. Elas entram como `tipo = 'rss'` e caem no
-- `Promise.all` dos feeds: em paralelo, sem espaçamento, sem timeout próprio.
--
-- Medido antes de inserir, com o NOSSO `lerFeed` rodando sobre o XML real:
-- 100 itens no feed, 15 lidos (o teto por fonte), título, link e data
-- corretos. Resposta em **1 segundo**.
--
-- O QUE ELA TRAZ, e é o que a Fase 1 queria
--
-- Com a consulta fechada abaixo: PlayStation.Blog BR, TudoCelular,
-- Adrenaline, Nintendo Blast, Tecnoblog, Omelete, Estadão — veículos que NÃO
-- estão nos 13 feeds cadastrados. É literalmente "o que saiu fora das minhas
-- fontes", que é a pergunta que um feed sozinho nunca responde.
--
-- O `when:1d` limita à janela de 24 h, igual ao que a GDELT fazia com
-- `timespan=24h`: radar de atualidade não quer notícia de semana passada.
--
-- O TRADE-OFF, ACEITO POR ELE E ESCRITO AQUI
--
-- O `<link>` de cada item é um redirecionador do Google
-- (`news.google.com/rss/articles/CBMi…`), não o endereço do veículo. No
-- navegador ele resolve e o editor chega no artigo; fora do navegador, não.
-- A URL que vai para as NOTAS do rascunho é a do Google.
--
-- O que compensa: o título do Google News termina com " - <Veículo>", então
-- o editor vê de onde é ANTES de clicar. Nenhuma fonte fica anônima.
--
-- POR QUE OS TERMOS DA CONSULTA NÃO VIOLAM A REGRA DELE
--
-- "Nada de palavra-chave, peso ou tratamento especial para assunto nenhum" —
-- e aqui não há. `playstation`, `xbox` e `nintendo` são **editorias do site**
-- (vivem no CHECK de `news_articles.editoria`), não assunto de matéria. A
-- distinção está escrita em `radarColetaDeDuasFontes.test.js`: taxonomia
-- nossa pode orientar a busca; "se o título falar de GTA, faça X" não pode.
--
-- E tudo isto é DADO: mudar o que se procura é editar esta linha, sem deploy.
-- A trava varre o CÓDIGO da Edge Function, que continua cego ao tema.
--
-- Testado em ROLLBACK antes de aplicar: as duas entram como `rss`, o radar
-- passa a ver 15 fontes ativas, as duas da GDELT seguem desligadas, e a
-- unicidade de `url` impede duplicata.

INSERT INTO news_sources (nome, url, tipo, ativa) VALUES
 ('Busca ampla · games',
  'https://news.google.com/rss/search?q=%22video+game%22+OR+games+OR+playstation+OR+xbox+OR+nintendo+OR+%22jogo+eletronico%22+when:1d&hl=pt-BR&gl=BR&ceid=BR:pt-150',
  'rss', true),
 ('Busca ampla · tecnologia e geek',
  'https://news.google.com/rss/search?q=tecnologia+OR+streaming+OR+anime+OR+quadrinhos+OR+%22cultura+pop%22+when:1d&hl=pt-BR&gl=BR&ceid=BR:pt-150',
  'rss', true)
ON CONFLICT (url) DO NOTHING;

-- As duas da GDELT continuam cadastradas e DESLIGADAS, de propósito: apagar
-- perderia o registro de que foram tentadas e por que saíram. A história
-- está em `DECISOES.md`.
UPDATE news_sources SET ativa = false WHERE tipo = 'api';
