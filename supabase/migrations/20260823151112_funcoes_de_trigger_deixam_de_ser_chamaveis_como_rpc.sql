-- Achado do `get_advisors` que eu registrei e nao tinha fechado.
--
-- `checar_palavras_bloqueadas` e `resolver_moderacao_de_conteudo_apagado` sao
-- funcoes de TRIGGER, mas estavam executaveis por `anon` via
-- `/rest/v1/rpc/<nome>`. Chamar direto quebraria (as variaveis TG_ vem nulas),
-- entao o risco pratico e baixo — mas e superficie de API que nao devia
-- existir, e superficie que nao devia existir e onde a proxima falha se
-- esconde (§1.3).
--
-- Trigger dispara INDEPENDENTE de EXECUTE: o Postgres checa esse privilegio na
-- criacao do trigger, nao a cada disparo. Revogar aqui nao afeta nada do que
-- funciona hoje.
REVOKE ALL ON FUNCTION public.checar_palavras_bloqueadas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolver_moderacao_de_conteudo_apagado() FROM PUBLIC, anon, authenticated;

-- `motivo_legivel` e helper interno de texto; nao precisa estar na API.
REVOKE ALL ON FUNCTION public.motivo_legivel(text) FROM PUBLIC, anon, authenticated;;
