-- `[26/09]` A lista de fontes corrigida — e a correção veio de uma MEDIÇÃO dele.
--
-- A PERGUNTA. Ele leu a primeira lista e disse: *"ela pega fontes atuais? Não
-- vi nada de GTA aqui, iPhone 18 e tals... tem que ser coisas da atualidade,
-- tipo vingadores, esse tipo de coisa"*.
--
-- O QUE EU MEDI, puxando os 12 feeds e lendo o que veio hoje:
--
--   ATUALIDADE ele tinha razão de perguntar e a resposta é SIM: vieram Halo
--              Studios, demissões no Xbox, Resident Evil Requiem, Castlevania
--              40 anos, Diablo 4. É notícia de hoje, não de treino de modelo.
--
--   RUÍDO      mas ele estava certo no problema. Tecnoblog devolveu, nas
--              quatro primeiras: "Melhor notebook Asus", "Galaxy S26 com
--              cupom", "Galaxy Tab com 34% OFF" e "Como justificar o voto pelo
--              e-Título". Zero de quatro. Olhar Digital: uma de quatro.
--              São sites de tech de CONSUMO — vivem de cupom e review, não de
--              pauta. Cada item deles ocupa uma vaga que uma pauta boa perdeu.
--
--   BURACO     "tipo vingadores" não tinha fonte NENHUMA. `cultura` é uma das
--              9 editorias do News e a cobertura era acidental, caindo pelo
--              feed mais ruidoso da lista.
--
-- SAEM, com o motivo:
--   Tecnoblog      4 de 4 primeiras eram cupom/review/fora do assunto
--   Olhar Digital  1 de 4; o resto é promoção e corporativo
--
-- ENTRAM, todas medidas (HTTP 200, contagem de itens, e LENDO o que veio):
--   IGN Brasil           36 itens · games em português — Final Fantasy 7,
--                        Halo, Resident Evil, Dragon Ball
--   Legião dos Heróis    10 itens · cultura geek BR. A primeira leitura trouxe
--                        literalmente "Vingadores: Ultimato | Nova versão pode
--                        revelar aliança para Doutor Destino", Senhor dos
--                        Anéis e Disney+ — é o exemplo que ele deu
--   Ars Technica Gaming  20 itens · games com profundidade editorial
--                        (reestruturação do Xbox, SteamOS, Steam Frame)
--
-- TESTADAS E RECUSADAS nesta rodada, para ninguém tentar de novo:
--   Tom's Hardware   200/50 itens, mas é hardware de datacenter: "SpaceX
--                    660.000 GPUs", "Tower Semiconductor investe US$ 4 bi".
--                    Não é GamerHub
--   MacMagazine      HTTP 403
--   Omelete          HTTP 404 em /rss
--   Jovem Nerd       HTTP 404 em /rss
--   Adoro Cinema     HTTP 404
--   TecMundo         HTTP 204 (corpo vazio) — de novo
--   Voxel            HTTP 200 com zero item
--   9to5Mac          funciona (100 itens), mas é 100% Apple: estreito demais
--                    para uma vaga de fonte. Fica anotado caso `mobile` vire
--                    editoria de peso
--
-- NOTA SOBRE A POLYGON: ela respondeu 10 itens em 25/09 e ZERO hoje. Fica
-- ativa de propósito — queda de feed de terceiro é o caso normal, e a função
-- já reporta quem não respondeu em `comFalha`. Desligar na primeira falha
-- transformaria intermitência em decisão permanente.
--
-- Idempotente: `on conflict` na URL única, e o `update` do `ativa=false` roda
-- sobre nome, não sobre id.

update news_sources set ativa = false
 where url in ('https://tecnoblog.net/feed/', 'https://olhardigital.com.br/feed/');

insert into news_sources (nome, url, tipo) values
  ('IGN Brasil',          'https://br.ign.com/feed.xml',                      'rss'),
  ('Legião dos Heróis',   'https://www.legiaodosherois.com.br/feed',          'rss'),
  ('Ars Technica Games',  'https://feeds.arstechnica.com/arstechnica/gaming', 'rss')
on conflict on constraint news_sources_url_unica do nothing;
