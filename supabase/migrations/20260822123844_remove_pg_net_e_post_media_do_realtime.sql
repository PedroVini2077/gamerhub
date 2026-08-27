-- Dois itens do backlog que estavam parados por um motivo que nao se confirmou.
--
-- 1) pg_net fora do schema public
--
-- O backlog dizia "adiado de proposito: ALTER EXTENSION SET SCHEMA pode quebrar
-- webhooks/triggers que referenciam net.*". Duas coisas foram verificadas antes
-- de mexer, e as duas contrariam essa nota:
--
--   * NADA usa pg_net neste banco. Zero funcoes com `net.` no corpo, zero
--     triggers, zero objetos dependentes, e o schema `supabase_functions`
--     (dos Database Webhooks) nem existe.
--   * `ALTER EXTENSION pg_net SET SCHEMA` NAO E POSSIVEL — a extensao nao
--     suporta a operacao ("extension pg_net does not support SET SCHEMA").
--     Ou seja, o plano registrado no backlog nunca teria funcionado.
--
-- Como nada usa, a saida correta e remover em vez de mover. Isso fecha o
-- advisor `extension_in_public`, que era o ultimo achado de seguranca do tipo.
--
-- REVERSIVEL: se um dia for preciso usar Database Webhooks pelo painel da
-- Supabase, basta `CREATE EXTENSION pg_net;` (o painel inclusive recria
-- sozinho ao criar o primeiro webhook).
--
-- Testado em ROLLBACK antes: a remocao nao quebrou nenhuma dependencia, as 60
-- funcoes de `public` seguiram validas e as RPCs continuaram executando.

DROP EXTENSION IF EXISTS pg_net;

-- 2) post_media fora da publicacao de realtime (item C3-b)
--
-- Toda alteracao em post_media era transmitida para todos os clientes
-- conectados. Verificado que NINGUEM assina essa tabela via realtime no
-- frontend — a UI resolve mídia por retry, nao por evento. A tabela tem 0
-- linhas hoje, entao a remocao tambem nao tem efeito colateral imediato.
--
-- `admin_logs` continua na publicacao de proposito: duas telas dependem do
-- evento hoje (aba Logs do admin e o painel de notificacoes do dono). Sai numa
-- mudanca propria, junto com a substituicao por polling.

ALTER PUBLICATION supabase_realtime DROP TABLE public.post_media;;
