-- ============================================================================
-- FASE 4 do radar — a fonte de VÍDEO, e por que ela é um tipo NOVO
-- ============================================================================
--
-- O YouTube não entra como `api` nem como `rss` porque ele não produz
-- MANCHETE: ele produz SINAL. O `coletarTudo` despacha por tipo e só conhece
-- quem alimenta a lista que vai ao modelo; uma fonte de vídeo ali seria lida
-- como manchete, e "um youtuber disse" passaria a valer o mesmo que "a
-- Eurogamer publicou" — que é exatamente o que o radar existe para não fazer.
--
-- Tipo próprio também faz o `index.ts` separá-la explicitamente, em vez de
-- depender de alguém lembrar.
--
-- ## A URL guarda o ASSUNTO, nunca a chave nem a proteção
--
-- `news_sources.url` tem `CHECK (url ~* '^https?://')`, então a linha guarda a
-- URL inteira — mesma convenção das duas buscas amplas do Google News.
--
-- Mas `type`, `order` e `publishedAfter` são **sobrescritos pelo código** por
-- cima do que estiver aqui, e a `key` é acrescentada do ambiente. Quem cadastra
-- escolhe o assunto; os três parâmetros que decidem se o sinal significa alguma
-- coisa não são configuração (ver `youtube.ts`).
--
-- Isso importa: sem `type=video` a API devolve CANAL — medido no primeiro teste
-- real da chave, no navegador do dono.
--
-- ## UMA fonte, e é a cota que decide
--
-- `search.list` tem teto SEPARADO de 100 por dia, enquanto o geral é 10.000
-- unidades. O código faz UMA busca por clique de editor; uma segunda fonte
-- ativa não seria consultada — ela viraria linha em `comFalha` dizendo que
-- ficou de fora. Por isso entra uma só, com os dois assuntos no mesmo `q`.
-- ============================================================================

ALTER TABLE public.news_sources DROP CONSTRAINT news_sources_tipo;

ALTER TABLE public.news_sources
  ADD CONSTRAINT news_sources_tipo
  CHECK (tipo = ANY (ARRAY['site'::text, 'rss'::text, 'api'::text, 'youtube'::text]));

INSERT INTO public.news_sources (nome, url, tipo, ativa)
VALUES (
  'YouTube · sinal de video',
  'https://www.googleapis.com/youtube/v3/search?q=games+OR+gameplay+OR+playstation+OR+xbox+OR+nintendo+OR+anime+OR+%22cultura+pop%22&part=snippet&regionCode=BR&relevanceLanguage=pt&maxResults=50',
  'youtube',
  true
)
ON CONFLICT (url) DO NOTHING;
