-- ============================================================================
-- `[25/09]` GAMERHUB NEWS — a fundacao: tabelas, RLS, grants e constraints
-- ============================================================================
--
-- POR QUE UM DOMINIO SEPARADO, E NAO `posts.category = 'news'`
-- --------------------------------------------------------------
-- Pedido explicito do dono. E a razao e estrutural, nao organizacional: um
-- artigo editorial tem FONTE, SLUG, RASCUNHO, AGENDAMENTO, REVISAO e AUTORIA
-- editorial. Nada disso existe num post de comunidade, e enfiar tudo em
-- `posts` faria cada uma dessas colunas nascer nula em 100% das linhas.
--
-- A coluna `posts.category` foi apagada em 24/09 justamente porque nao
-- sustentava nem a distincao simples que prometia.
--
-- NEWS E LOGADO — decisao dele em 24/09
-- ---------------------------------------
-- `anon` NAO alcanca nenhuma destas tabelas. Consequencia registrada no
-- `DECISOES.md`: artigo atras de login nao e indexavel, entao `Article`
-- schema, pre-render e SSG perdem o objeto.
--
-- QUEM PODE O QUE — e o que AINDA e decisao dele
-- ------------------------------------------------
--   ler publicado ....... qualquer conta (authenticated)
--   ler rascunho ........ so equipe (is_staff)
--   criar / editar ...... equipe (is_staff) E operador ativo
--   apagar .............. super admin e owner (is_super)
--
-- O corte entre "editar" e "apagar" e deliberado. O prompt dele pede para
-- "nao assumir que todo admin possui todas essas capacidades sem analisar a
-- politica desejada", e esta e a analise: a que existe hoje, e que ele pode
-- mudar com uma migration de uma linha.
--
-- POR QUE `operador_ativo()` NAS POLICIES DE ESCRITA
-- ----------------------------------------------------
-- SEC-043: admin BANIDO ou SUSPENSO continuava mandando no site, porque o
-- estado do operador nunca fazia parte da autorizacao — so o cargo dele. Toda
-- tabela nova nasce com essa licao dentro.
--
-- `news_items_raw` NAO TEM POLICY NENHUMA, E ISSO E DE PROPOSITO
-- ----------------------------------------------------------------
-- E a caixa de entrada da ingestao: conteudo de TERCEIRO, nao verificado, nao
-- revisado, possivelmente com direito autoral alheio. Ninguem le essa tabela
-- pela REST API — nem a equipe. O acesso acontece por RPC, quando ela existir.
--
-- > `[25/09]` Os GRANTS dela vieram sozinhos, do `pg_default_acl`, e foram
-- > revogados na migration seguinte (SEC-052). Ver la: toda tabela nova nasce
-- > ABERTA neste banco, e o `BANCO.md` afirmava o contrario.

-- ── FONTES ──────────────────────────────────────────────────────────────────
CREATE TABLE public.news_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  url             text NOT NULL,
  tipo            text NOT NULL DEFAULT 'site',
  ativa           boolean NOT NULL DEFAULT true,
  ultima_coleta   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_sources_nome_nao_vazio CHECK (length(btrim(nome)) > 0),
  CONSTRAINT news_sources_url_http CHECK (url ~* '^https?://'),
  CONSTRAINT news_sources_tipo CHECK (tipo IN ('site', 'rss', 'api')),
  CONSTRAINT news_sources_url_unica UNIQUE (url)
);

-- ── ARTIGOS ─────────────────────────────────────────────────────────────────
CREATE TABLE public.news_articles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  titulo        text NOT NULL,
  subtitulo     text,
  resumo        text,
  conteudo      text NOT NULL,
  capa_url      text,
  editoria      text NOT NULL DEFAULT 'gaming',
  status        text NOT NULL DEFAULT 'draft',
  publicado_em  timestamptz,
  agendado_para timestamptz,
  autor_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  fonte_id      uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  fonte_url     text,
  destaque      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_articles_slug_formato CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT news_articles_slug_unico UNIQUE (slug),
  CONSTRAINT news_articles_titulo_nao_vazio CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT news_articles_conteudo_nao_vazio CHECK (length(btrim(conteudo)) > 0),
  CONSTRAINT news_articles_status CHECK (status IN ('draft','scheduled','published','archived')),
  CONSTRAINT news_articles_editoria CHECK (editoria IN (
    'gaming','tecnologia','geek','ia','hardware','internet','cultura-pop','filmes-series','industria'
  )),
  CONSTRAINT news_articles_publicado_tem_data
    CHECK (status <> 'published' OR publicado_em IS NOT NULL),
  CONSTRAINT news_articles_agendado_tem_data
    CHECK (status <> 'scheduled' OR agendado_para IS NOT NULL),
  CONSTRAINT news_articles_capa_http CHECK (capa_url IS NULL OR capa_url ~* '^https?://'),
  CONSTRAINT news_articles_fonte_url_http CHECK (fonte_url IS NULL OR fonte_url ~* '^https?://')
);

ALTER TABLE public.news_articles ADD COLUMN busca tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.portugues_sem_acento',
      coalesce(titulo,'') || ' ' || coalesce(subtitulo,'') || ' '
      || coalesce(resumo,'') || ' ' || coalesce(conteudo,''))
  ) STORED;

COMMENT ON COLUMN public.news_articles.busca IS
  'Indice de texto do artigo. Entrou junto com a tabela de proposito: coluna gerada custa nada numa tabela VAZIA, e acrescenta-la depois exigiria reescrever a tabela com conteudo dentro.';

-- ── TAGS ────────────────────────────────────────────────────────────────────
CREATE TABLE public.news_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL,
  nome       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_tags_slug_formato CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT news_tags_slug_unico UNIQUE (slug),
  CONSTRAINT news_tags_nome_nao_vazio CHECK (length(btrim(nome)) > 0)
);

CREATE TABLE public.news_article_tags (
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.news_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- ── CAIXA DE ENTRADA DA INGESTAO ────────────────────────────────────────────
CREATE TABLE public.news_items_raw (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_id     uuid REFERENCES public.news_sources(id) ON DELETE CASCADE,
  url          text NOT NULL,
  titulo       text,
  resumo       text,
  publicado_em timestamptz,
  coletado_em  timestamptz NOT NULL DEFAULT now(),
  processado   boolean NOT NULL DEFAULT false,
  -- A mesma URL coletada duas vezes e a MESMA noticia: a deduplicacao comeca
  -- aqui, no banco, e nao numa comparacao de texto depois.
  CONSTRAINT news_items_raw_url_unica UNIQUE (url)
);

-- ── INDICES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_news_articles_publicados
  ON public.news_articles (publicado_em DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX idx_news_articles_status ON public.news_articles (status);
CREATE INDEX idx_news_articles_busca ON public.news_articles USING GIN (busca)
  WHERE status = 'published';
CREATE INDEX idx_news_articles_autor ON public.news_articles (autor_id);
CREATE INDEX idx_news_articles_fonte ON public.news_articles (fonte_id);
CREATE INDEX idx_news_article_tags_tag ON public.news_article_tags (tag_id);
CREATE INDEX idx_news_items_raw_fonte ON public.news_items_raw (fonte_id);
CREATE INDEX idx_news_items_raw_pendentes ON public.news_items_raw (coletado_em DESC)
  WHERE processado = false;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.news_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_items_raw    ENABLE ROW LEVEL SECURITY;

CREATE POLICY news_articles_select ON public.news_articles FOR SELECT
  USING ((status = 'published' AND publicado_em <= now()) OR is_staff());
CREATE POLICY news_articles_insert ON public.news_articles FOR INSERT
  WITH CHECK (is_staff() AND operador_ativo());
CREATE POLICY news_articles_update ON public.news_articles FOR UPDATE
  USING (is_staff() AND operador_ativo())
  WITH CHECK (is_staff() AND operador_ativo());
CREATE POLICY news_articles_delete ON public.news_articles FOR DELETE
  USING (is_super() AND operador_ativo());

CREATE POLICY news_tags_select ON public.news_tags FOR SELECT USING (true);
CREATE POLICY news_tags_escrita ON public.news_tags FOR ALL
  USING (is_staff() AND operador_ativo())
  WITH CHECK (is_staff() AND operador_ativo());

CREATE POLICY news_article_tags_select ON public.news_article_tags FOR SELECT USING (true);
CREATE POLICY news_article_tags_escrita ON public.news_article_tags FOR ALL
  USING (is_staff() AND operador_ativo())
  WITH CHECK (is_staff() AND operador_ativo());

CREATE POLICY news_sources_equipe ON public.news_sources FOR ALL
  USING (is_staff())
  WITH CHECK (is_staff() AND operador_ativo());

-- `news_items_raw`: RLS ligada e NENHUMA policy. Ninguem alcanca pela API.

-- ── GRANTS ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_articles     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_tags         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_article_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_sources      TO authenticated;

COMMENT ON TABLE public.news_sources IS 'Fontes editoriais do GamerHub News. So a equipe ve: fonte e bastidor, nao conteudo.';
COMMENT ON TABLE public.news_articles IS 'Artigos do GamerHub News. LOGADO (decisao do dono em 24/09): anon nao alcanca. Publicado e legivel por qualquer conta; rascunho, so pela equipe.';
COMMENT ON TABLE public.news_items_raw IS 'Caixa de entrada da ingestao: conteudo de TERCEIRO, nao verificado. RLS ligada e ZERO policies de proposito - ninguem le pela REST API, nem a equipe. O acesso sera por RPC, com recorte decidido na hora.';
COMMENT ON TABLE public.news_tags IS 'Tags do News.';
COMMENT ON TABLE public.news_article_tags IS 'Ligacao artigo <-> tag.';
