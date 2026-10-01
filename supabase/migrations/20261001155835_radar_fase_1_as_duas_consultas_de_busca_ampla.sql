-- `[01/10]` FASE 1 do radar: a segunda fonte de coleta entra como DADO.
--
-- O radar respondia "o que as 13 fontes que escolhemos publicaram?". Um feed
-- só enxerga o próprio site, então ele nunca responde "o que saiu FORA das
-- minhas fontes" — que é a pergunta do dono.
--
-- POR QUE ISTO É UMA LINHA DE TABELA E NÃO UMA CONSTANTE NO CÓDIGO
--
-- Ordem dele, na letra: "Não crie lógica específica, palavras-chave
-- hardcoded, fontes especiais, pesos especiais ou tratamento especial para
-- GTA, Rockstar, Marvel, Avengers ou qualquer outro assunto citado nos
-- exemplos. O sistema precisa ser GENÉRICO."
--
-- Então o que se procura mora aqui, e o motor fica cego ao tema. Mudar a
-- consulta é editar uma linha; não é deploy. E `radarColetaDeDuasFontes`
-- varre o código da Edge Function e reprova se algum assunto aparecer lá.
--
-- NENHUMA MIGRATION DE SCHEMA FOI PRECISA, e isso foi medido, não suposto:
-- `news_sources_tipo` já era CHECK (tipo IN ('site','rss','api')) desde a
-- fundação do News. `'api'` estava lá e nunca tinha sido usado.
--
-- As duas consultas são amplas e em português, derivadas do que o SITE cobre
-- (games · tecnologia · cultura geek) e não de franquia nenhuma.
--
-- SÃO DUAS, E O TETO É DELIBERADO. A GDELT exige 5 s entre requisições —
-- medido no corpo de um 429, não documentado por ela. As consultas vão em
-- SÉRIE, então 2 custam ~5 s de espera para o editor que clicou e 4 custariam
-- ~16 s. Subir isto exige tirar a coleta de dentro do clique, que é outra
-- arquitetura e outra fase.
--
-- O 429 da GDELT é CASO ESPERADO, não falha nossa: ele vira linha em
-- `comFalha`, a tela diz, e a coleta do RSS segue intacta.
--
-- Testado em ROLLBACK antes de aplicar: as duas entram, o radar passa a ver
-- 13 rss + 2 api, e o CHECK continua recusando tipo inventado.

INSERT INTO news_sources (nome, url, tipo, ativa) VALUES
 ('Busca ampla · games',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=(videogame%20OR%20videogames%20OR%20%22jogo%20eletronico%22)%20sourcelang:portuguese&mode=ArtList&format=json&maxrecords=25&timespan=24h&sort=datedesc',
  'api', true),
 ('Busca ampla · tecnologia e geek',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=(tecnologia%20OR%20streaming%20OR%20anime%20OR%20quadrinhos)%20sourcelang:portuguese&mode=ArtList&format=json&maxrecords=25&timespan=24h&sort=datedesc',
  'api', true)
ON CONFLICT (url) DO NOTHING;
