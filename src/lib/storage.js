import { supabase } from './supabase';

// Extrai o path interno do bucket `post-media` a partir de uma URL pública
// (https://.../storage/v1/object/public/post-media/<path>). Retorna null para
// URLs de fora do bucket (embeds, avatares, etc.).
export function postMediaPathFromUrl(url) {
  if (typeof url !== 'string') return null;
  const marker = '/post-media/';
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// Remove arquivos do bucket `post-media` a partir de URLs públicas.
// Best-effort: a policy de DELETE do Storage só permite apagar arquivos do
// próprio usuário (pasta = auth.uid()), então quando um admin deleta o post
// de outra pessoa o arquivo fica pra trás — falha aqui nunca bloqueia a
// exclusão do post em si (no pior caso sobra um órfão no bucket, não um erro
// pro usuário).
export async function removeFilesFromStorage(urls) {
  const paths = (urls || []).map(postMediaPathFromUrl).filter(Boolean);
  if (!paths.length) return;
  try {
    await supabase.storage.from('post-media').remove(paths);
  } catch {
    // best-effort: órfão eventual é preferível a quebrar o fluxo de delete
  }
}
