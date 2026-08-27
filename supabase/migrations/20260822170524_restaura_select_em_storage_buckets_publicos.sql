-- UPLOAD DE FOTO ESTAVA QUEBRADO PARA TODO MUNDO.
--
-- Sintoma: "da erro ao fazer upload de foto". Reproduzido chamando a API real
-- com um usuario autenticado:
--
--   POST /storage/v1/object/avatars/<uid>/avatar.png
--   -> 400 {"error":"Unauthorized","message":"new row violates row-level security policy"}
--
-- A mensagem apontava para a policy do objeto, mas nao era ela. Isolando o
-- banco da API:
--
--   INSERT direto em storage.objects como `authenticated`  -> OK, a policy passa
--   SELECT em storage.buckets como `authenticated`         -> 0 LINHAS
--
-- `storage.buckets` esta com RLS ligado e ZERO policies, entao o bucket fica
-- invisivel para quem chama. A API de storage valida o bucket lendo essa tabela
-- com o papel do usuario; sem enxergar, o upload e recusado.
--
-- Origem: a faxina de storage de uma sessao anterior removeu as policies amplas
-- de SELECT que permitiam listar arquivos de todo mundo — correcao legitima —
-- mas levou junto a leitura da lista de BUCKETS, que nao tem nada de sensivel:
-- o nome do bucket aparece em toda URL publica de imagem do site.
--
-- Esta policy devolve so o necessario, e so dos buckets PUBLICOS. Ela nao
-- reabre a listagem de arquivos: `storage.objects` continua sem policy de
-- SELECT, que era o ponto da faxina original.

CREATE POLICY "Buckets publicos sao visiveis"
  ON storage.buckets
  FOR SELECT
  TO authenticated, anon
  USING (public = true);;
