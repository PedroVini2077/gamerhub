-- `[26/09]` As fontes de RSS que o radar de pautas lê.
--
-- POR QUE ISTO É DADO E MESMO ASSIM VIRA MIGRATION. `news_sources` estava
-- vazia, e função que lê tabela vazia devolve "nenhuma fonte cadastrada" — o
-- radar nasceria inerte e pareceria quebrado. Semear por `execute_sql` não
-- deixaria rastro nenhum (CLAUDE.md §5, o buraco de rastreabilidade); numa
-- migration a lista fica versionada e o motivo de cada linha fica junto.
--
-- AS 12 FORAM MEDIDAS, NÃO LEMBRADAS. Em 26/09 eu bati em 22 candidatas com
-- `curl` e anotei o HTTP e a contagem de itens de cada uma. Entram as que
-- responderam 200 com item; ficam de fora, com o motivo:
--
--   Adrenaline        HTTP 403  (bloqueia robô)
--   TecMundo          HTTP 204  (corpo vazio)
--   GameVicio         HTTP 404
--   IGN (site)        HTTP 403  — o espelho do FeedBurner devolve 1 item só
--   The Enemy         não resolveu
--   Flow Games        HTTP 404
--   Jovem Nerd        HTTP 404
--   Nintendo Blast    200, mas 1 item (feed padrão do Blogger)
--
-- Escrever a lista dos que NÃO entraram é o que impede alguém — inclusive eu,
-- daqui a três meses — de "consertar" isto reincluindo um feed morto.
--
-- `ativa` é `true` por padrão: desligar uma fonte é um UPDATE, e a tela de
-- gerenciar fonte está no BACKLOG. Até lá, ligar/desligar é ação de banco.
--
-- Idempotente por `news_sources_url_unica` — reaplicar não duplica.

insert into news_sources (nome, url, tipo) values
  -- ── Brasil ──
  ('Canaltech',            'https://canaltech.com.br/rss/',              'rss'),
  ('Tecnoblog',            'https://tecnoblog.net/feed/',                'rss'),
  ('GameHall',             'https://gamehall.com.br/feed/',              'rss'),
  ('Olhar Digital',        'https://olhardigital.com.br/feed/',          'rss'),
  ('Meio Bit',             'https://meiobit.com/feed/',                  'rss'),
  -- ── Internacionais ──
  ('The Verge — Games',    'https://www.theverge.com/rss/games/index.xml','rss'),
  ('Polygon',              'https://www.polygon.com/rss/index.xml',      'rss'),
  ('PC Gamer',             'https://www.pcgamer.com/rss/',               'rss'),
  ('Rock Paper Shotgun',   'https://www.rockpapershotgun.com/feed',      'rss'),
  ('GameSpot',             'https://www.gamespot.com/feeds/news/',       'rss'),
  ('Eurogamer',            'https://www.eurogamer.net/feed',             'rss'),
  ('Kotaku',               'https://kotaku.com/rss',                     'rss')
on conflict on constraint news_sources_url_unica do nothing;

comment on table news_sources is
  'Fontes que o radar de pautas le. `tipo=rss` e o unico que a Edge Function '
  '`radar-de-pautas` consome hoje. A lista inicial foi MEDIDA com curl em 26/09 — '
  'ver a migration news_fontes_rss_iniciais para as que ficaram de fora e por que.';
