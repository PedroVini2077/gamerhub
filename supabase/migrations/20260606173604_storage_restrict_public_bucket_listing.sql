-- Buckets públicos (avatars, post-media) tinham policy SELECT ampla que permitia
-- LISTAR todos os arquivos. O acesso por URL pública NÃO depende dessa policy
-- (bucket público é servido pela CDN sem RLS). Remove a listagem para não expor
-- a enumeração de arquivos. App usa apenas getPublicUrl + upload — não usa .list().
DROP POLICY "Avatars publicos" ON storage.objects;
DROP POLICY "Mídias públicas" ON storage.objects;;
