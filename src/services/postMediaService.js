import { supabase } from '../lib/supabase';
import { ok, fail } from './result';
import { compressMedias } from '../lib/image';

/**
 * `[18/09]` Mídia de post: storage, upload e a tabela `post_media`.
 *
 * Extraído do `postService.js` quando ele passou de 300 linhas (§4). É corte
 * MECÂNICO — o código não mudou, só mudou de arquivo. A fronteira é de
 * responsabilidade e não de tamanho: aqui é o único lugar do domínio de post
 * que conversa com o **storage**, enquanto o resto do `postService` conversa
 * com **tabela**. São falhas diferentes e custos diferentes (byte no bucket ×
 * linha no banco), e misturá-las era o que fazia o arquivo crescer.
 */

export async function fetchPostMedia(postId) {
  const { data, error } = await supabase.from('post_media').select('*').eq('post_id', postId).order('position');
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function uploadAudio(userId, audioFile) {
  const ext = audioFile.name.split('.').pop();
  const path = `${userId}/audio-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('post-media').upload(path, audioFile, { contentType: audioFile.type, cacheControl: '31536000' });
  if (error) return fail(error);
  const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
  return ok(publicUrl);
}

export async function uploadPostMediaFiles(userId, postId, medias) {
  const rows = [];
  const imageUrls = [];
  // `[29/08]` As URLs de vídeo saem daqui também. Elas são o plano B da
  // moderação: quando o navegador recusa decodificar o arquivo LOCAL, a mesma
  // mídia já está publicada e pode ser lida do storage. Ver `moderateVideos`.
  const videoUrls = [];
  // Comprime ANTES de subir: o arquivo no bucket é o que o CDN serve a cada
  // view. Vídeo/áudio passam intactos.
  const prepared = await compressMedias(medias);
  let failed = 0;
  for (let i = 0; i < prepared.length; i++) {
    const { file, type } = prepared[i];
    const ext = file.name.split('.').pop();
    const path = `${userId}/${postId}-${i}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    // O erro do upload era ignorado: a linha ia pro banco mesmo assim e o post
    // ficava com uma imagem quebrada pra sempre, apontando pra um arquivo que
    // nunca existiu. Agora a mídia que falhou simplesmente não é registrada.
    if (uploadError) { failed++; continue; }
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    rows.push({ post_id: postId, url: publicUrl, type, position: i });
    if (type === 'image') imageUrls.push(publicUrl);
    if (type === 'video') videoUrls.push(publicUrl);
  }
  const carga = { imageUrls, videoUrls, failed };
  if (!rows.length) {
    return failed ? { data: carga, error: { message: 'Falha ao enviar a mídia.' } } : ok(carga);
  }
  const { error } = await supabase.from('post_media').insert(rows);
  return error ? { data: carga, error } : ok(carga);
}
