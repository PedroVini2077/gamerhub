import { supabase } from '../lib/supabase';
import { ok, fail, from } from './result';

// Perfil público de OUTRA pessoa. Via RPC porque as colunas sensíveis foram
// revogadas de `authenticated` — e porque a página mostra a IDADE, não a data
// de nascimento: `get_public_profile` calcula a idade no banco, então o dado
// pessoal nunca sai de lá.
export async function fetchProfileByUsername(username) {
  const { data, error } = await supabase
    .rpc('get_public_profile', { p_username: username })
    .maybeSingle();
  if (error) return fail(error);
  return ok(data || null);
}

export async function fetchUserXP(userId) {
  const { data, error } = await supabase.rpc('get_user_xp', { p_user_id: userId });
  if (error) return fail(error);
  return ok(data || null);
}

// Conta curtidas recebidas somando os likes de todos os posts do usuário.
// `head: true` traz só o Content-Range (contagem) — zero linhas no payload.
// Fatiado porque cada uuid custa ~40 caracteres na URL do `.in(...)`: um perfil
// com centenas de posts estouraria o limite do gateway numa chamada só.
const IN_CHUNK = 50;

async function countLikesOnPosts(postIds) {
  let total = 0;
  for (let i = 0; i < postIds.length; i += IN_CHUNK) {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .in('post_id', postIds.slice(i, i + IN_CHUNK));
    total += count || 0;
  }
  return total;
}

export async function fetchProfileStats(userId) {
  // Antes isto somava `posts.likes` — uma coluna desnormalizada que NENHUM
  // trigger mantém, então o total de curtidas do perfil vinha sempre 0.
  // Agora conta de `post_likes`, a fonte de verdade real.
  const [{ data: posts }, { data: xp }] = await Promise.all([
    supabase.from('posts').select('id').eq('user_id', userId).is('deleted_at', null),
    supabase.rpc('get_user_xp', { p_user_id: userId }),
  ]);
  const ids = (posts || []).map(p => p.id);
  return ok({ posts: ids.length, likes: await countLikesOnPosts(ids), xp: xp || null });
}

export async function updateProfile(userId, fields) {
  return from(await supabase.from('profiles').update(fields).eq('id', userId));
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    // cacheControl de 1 ano: o avatar aparece em TODO card do feed e, sem isso,
    // o CDN revalidava a cada ~1h por viewer. A troca de avatar continua
    // aparecendo na hora porque a URL carrega o cache-buster `?t=` abaixo.
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '31536000' });
  if (error) return fail(error);
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return ok(publicUrl + `?t=${Date.now()}`);
}

// Uma preferência de cada vez: a tela tem um toggle por linha, e mandar as
// duas junto sobrescreveria a outra com o valor que estava em memória.
export async function updateNotifPref(userId, campo, valor) {
  const coluna = campo === 'likes' ? 'notif_likes' : 'notif_comments';
  return from(await supabase.from('profiles').update({ [coluna]: valor }).eq('id', userId));
}
