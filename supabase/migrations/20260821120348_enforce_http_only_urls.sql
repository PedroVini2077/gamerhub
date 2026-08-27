-- Defesa em profundidade contra XSS por URL: o cliente já sanea (lib/url.js),
-- mas qualquer pessoa com a anon key pode chamar a REST API direto e pular o
-- frontend inteiro. A regra tem que existir no banco.
--
-- Contexto: `getEmbedInfo` aceitava QUALQUER string (inclusive
-- `javascript:...`), e o EmbedPlayer renderizava isso como `<a href>`.
-- Um clique de qualquer visitante executava script na origem do site, com o
-- token de sessão do Supabase acessível no localStorage.

-- Normaliza string vazia -> NULL (o form de keys gravava '' quando o admin
-- não preenchia a URL da promoção).
UPDATE public.game_keys SET promo_url = NULL WHERE promo_url = '';

-- VALIDATE roda contra as linhas existentes: se algo passar aqui, é porque a
-- base já está limpa (conferido antes de aplicar).
ALTER TABLE public.posts
  ADD CONSTRAINT posts_embed_url_http_only
  CHECK (embed_url IS NULL OR embed_url ~* '^https?://');

ALTER TABLE public.game_keys
  ADD CONSTRAINT game_keys_promo_url_http_only
  CHECK (promo_url IS NULL OR promo_url ~* '^https?://');

ALTER TABLE public.post_media
  ADD CONSTRAINT post_media_url_http_only
  CHECK (url ~* '^https?://');

ALTER TABLE public.community_post_media
  ADD CONSTRAINT cpm_url_http_only
  CHECK (url ~* '^https?://');;
