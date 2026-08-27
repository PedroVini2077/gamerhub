-- Segunda metade da correcao do upload de foto.
--
-- Depois de devolver a visibilidade dos buckets publicos, o upload de midia de
-- post passou a funcionar, mas o de AVATAR continuava falhando. Isolado por
-- teste na API real:
--
--   POST /object/avatars/<uid>/avatar.png  SEM  x-upsert  -> 200 OK
--   POST /object/avatars/<uid>/avatar.png  COM  x-upsert  -> 400 RLS violation
--
-- E o site usa `upsert: true` no `uploadAvatar` (de proposito: o caminho do
-- arquivo e fixo por usuario, entao trocar a foto sobrescreve a anterior em vez
-- de acumular lixo no bucket).
--
-- O caminho de upsert precisa LER o objeto antes de decidir entre inserir e
-- substituir, e `storage.objects` ficou sem nenhuma policy de SELECT: a faxina
-- de storage de uma sessao anterior removeu as policies amplas que deixavam
-- qualquer um listar os arquivos de todo mundo. A remocao estava certa; o que
-- faltou foi devolver a leitura RESTRITA.
--
-- Esta policy devolve so isso: cada usuario enxerga apenas a PROPRIA pasta
-- (o primeiro segmento do path e o uid, que e como os dois buckets sao
-- organizados). Ninguem volta a listar arquivo alheio.
--
-- O acesso publico de leitura das imagens continua vindo da URL do CDN, que
-- nao passa por RLS — nada muda para quem so visualiza o site.

CREATE POLICY "Usuario enxerga os proprios arquivos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = (storage.foldername(name))[1]);;
