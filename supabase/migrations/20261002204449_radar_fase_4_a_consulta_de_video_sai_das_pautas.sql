-- ============================================================================
-- FASE 4, correção: a consulta de vídeo sai das PAUTAS, não da linha
-- ============================================================================
--
-- A primeira versão guardava o assunto aqui (`q=games OR gameplay OR …`) e
-- ordenava por data. **O primeiro clique real não achou nada** — 16 fontes
-- lidas, nenhum selo de vídeo e nenhuma linha em `comFalha`, e o silêncio nos
-- dois lugares é o que permite o diagnóstico: todo caminho de falha empurra
-- uma linha, então a API respondeu, vieram vídeos, e nenhuma pauta casou.
--
-- A causa: `order=date` + consulta genérica + 50 resultados devolve os 50
-- uploads MAIS RECENTES que mencionam "games" em algum lugar. São canais
-- pequenos postando qualquer coisa, e a chance de dois falarem de "GTA 6" é
-- quase nula. E o `order=date` nem resolvia o problema que eu inventei para
-- ele: o `publishedAfter` já garante "hoje" sozinho.
--
-- Hoje o `q` é montado com os termos das próprias pautas, depois que o modelo
-- as agrupa. Continua sendo UMA chamada — e agora ela é relevante por
-- construção, porque a consulta e a pergunta passaram a ser a mesma coisa.
--
-- **A linha perde o assunto e fica só com a base.** O motor fica ainda mais
-- cego ao tema do que antes: nem a tabela o nomeia. O `q` que sobrar aqui é
-- ignorado pelo código, e um teste reprova se ele voltar a mandar.
-- ============================================================================

UPDATE public.news_sources
   SET url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&regionCode=BR&relevanceLanguage=pt&maxResults=50',
       nome = 'YouTube · sinal de video (consulta vem das pautas)'
 WHERE tipo = 'youtube'
   AND url LIKE 'https://www.googleapis.com/youtube/v3/search?q=games+OR+gameplay%';
