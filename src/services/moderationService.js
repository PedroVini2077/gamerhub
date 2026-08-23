import { supabase } from '../lib/supabase';
import { ok, fail, from, fromCount } from './result';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function createReport({ contentType, contentId, reason, details }) {
  return from(await supabase.from('reports').insert({
    reporter_id: (await supabase.auth.getUser()).data.user?.id,
    content_type: contentType,
    content_id: contentId,
    reason,
    details: details?.trim() || null,
  }));
}

export async function fetchReports({ status = null, contentType = null } = {}) {
  let q = supabase.from('reports').select('*, reporter:profiles!reporter_id(username, avatar_url)')
    .order('created_at', { ascending: false });
  if (status)      q = q.eq('status', status);
  if (contentType) q = q.eq('content_type', contentType);
  const { data, error } = await q;
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function updateReportStatus(reportId, status) {
  return from(await supabase.from('reports').update({ status }).eq('id', reportId));
}

// ─── Moderation Queue ─────────────────────────────────────────────────────────

export async function fetchModerationQueue(status = 'pending', page = 0, pageSize = 20) {
  const { data, count, error } = await supabase
    .from('moderation_queue')
    .select('*, profiles!reviewed_by(username)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) return fail(error, { items: [], count: 0 });
  return ok({ items: data || [], count: count || 0 });
}

export async function resolveQueueItem(queueId, decision, contentType, contentId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;

  if (decision === 'approved') {
    // confirm hide: already hidden by trigger, just mark reviewed
  } else if (decision === 'rejected' && contentType !== 'chat') {
    // Restaura o conteúdo — reaproveita o helper que checa 0 linhas, em vez de
    // repetir o update cru (que ignorava falha de RLS).
    //
    // `chat` fica de fora porque `live_chat` não tem `hidden_at`: nada foi
    // escondido, então não há o que restaurar. Sem esta guarda, `restoreContent`
    // devolvia erro e a recusa do item falhava por inteiro — o item ficava
    // preso na fila para sempre.
    const res = await restoreContent(contentType, contentId);
    if (res.error) return res;
  }

  return from(await supabase.from('moderation_queue').update({
    status: decision,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', queueId));
}

// Enfileira manualmente (ex: admin oculta via wordlist)

// ─── Blocked Words ────────────────────────────────────────────────────────────

export async function fetchBlockedWords() {
  const { data, error } = await supabase.from('blocked_words').select('*').order('word');
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function addBlockedWord(word, severity = 'medium') {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  return from(await supabase.from('blocked_words').insert({ word: word.trim().toLowerCase(), severity, created_by: userId }));
}

export async function removeBlockedWord(wordId) {
  return from(await supabase.from('blocked_words').delete().eq('id', wordId));
}

// ─── Violations ───────────────────────────────────────────────────────────────

export async function fetchViolations(userId = null, page = 0, pageSize = 20) {
  let q = supabase
    .from('violations')
    .select('*, user_profile:profiles!user_id(username, avatar_url), reviewer:profiles!reviewed_by(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (Array.isArray(userId)) q = q.in('user_id', userId);
  else if (userId) q = q.eq('user_id', userId);
  const { data, count, error } = await q;
  if (error) return fail(error, { items: [], count: 0 });
  return ok({ items: data || [], count: count || 0 });
}

// Suspensão temporária (1 ou 7 dias). Bloqueia criar conteúdo via RLS.
// O banco limita a 1–30 dias: sem teto, um admin suspendia até o ano 2126 e
// virava banimento permanente pulando a hierarquia do ban.
export async function applySuspension(userId, days) {
  return from(await supabase.rpc('apply_suspension', { p_user_id: userId, p_days: days }));
}

// A reversão que não existia. Sem ela a suspensão era irreversível: o
// trigger-guarda de `profiles` reverte UPDATE direto em silêncio, então nem o
// fundador conseguia desfazer um engano.
export async function liftSuspension(userId, note) {
  return from(await supabase.rpc('lift_suspension', {
    p_user_id: userId,
    p_note: note?.trim() || null,
  }));
}

export async function addViolation({ userId, contentType, contentId, reason, actionTaken, points, notes }) {
  const reviewerId = (await supabase.auth.getUser()).data.user?.id;
  return from(await supabase.from('violations').insert({
    user_id: userId,
    content_type: contentType || null,
    content_id: contentId || null,
    reason: reason || null,
    action_taken: actionTaken,
    points: points ?? 1,
    reviewed_by: reviewerId,
    notes: notes?.trim() || null,
  }));
}

// ─── Moderação IA (Fases 2 e 3 — OpenAI omni-moderation) ────────────────────

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

// Fire-and-forget: texto — não bloqueia o fluxo do usuário.
//
// O `text` NÃO vai mais no corpo: a Edge Function lê o texto direto da linha no
// banco. Mandar o texto daqui era um buraco — bastava enviar o `content_id` de
// um post alheio junto de uma frase ofensiva qualquer para derrubar o post de
// outra pessoa. O parâmetro continua aqui só como guarda de "não tem o que
// moderar" antes de gastar uma chamada.
export async function moderateText(contentType, contentId, text) {
  if (!text?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId }),
  }).catch(() => {});
}

// Fire-and-forget: link — Google Safe Browsing (não bloqueia o fluxo).
export async function moderateLinks(contentType, contentId, url) {
  if (!url?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, url }),
  }).catch(() => {});
}

// Fire-and-forget: imagens (apenas URLs de imagem, vídeos são ignorados).
export async function moderateImages(contentType, contentId, imageUrls) {
  if (!imageUrls?.length) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, image_urls: imageUrls }),
  }).catch(() => {});
}

// ─── Hide / Restore (ação direta do admin) ───────────────────────────────────

// `count: 'exact'` + checagem de 0 linhas: sem isso o RLS negando a operação
// virava "sucesso" silencioso. Foi exatamente o que escondeu, por muito tempo,
// o fato de `comments` e `community_posts` não terem policy de UPDATE nenhuma —
// o painel dizia "ocultado" e nada acontecia.
// Mapa explícito em vez de `else → community_posts`: a fila recebe itens de
// `chat` (o trigger da lista de palavras enfileira mensagem de live), e o
// fallback silencioso mandava esse item para `community_posts`, onde o id nunca
// existe — o painel respondia "sem permissão" para um caso que é, na verdade,
// "esta tabela não tem como ocultar".
const TABELA_POR_TIPO = { post: 'posts', comment: 'comments', mural: 'community_posts' };

async function setHiddenAt(contentType, contentId, value) {
  const table = TABELA_POR_TIPO[contentType];
  if (!table) {
    return fail({ message: 'Mensagem de chat não pode ser ocultada — apague pela própria live.' });
  }
  const { error, count } = await supabase
    .from(table)
    .update({ hidden_at: value }, { count: 'exact' })
    .eq('id', contentId);
  return fromCount({ error, count }, 'Você não tem permissão para moderar este conteúdo.');
}

export function hideContent(contentType, contentId) {
  return setHiddenAt(contentType, contentId, new Date().toISOString());
}

export function restoreContent(contentType, contentId) {
  return setHiddenAt(contentType, contentId, null);
}
