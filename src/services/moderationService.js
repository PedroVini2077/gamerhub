import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function createReport({ contentType, contentId, reason, details }) {
  return supabase.from('reports').insert({
    reporter_id: (await supabase.auth.getUser()).data.user?.id,
    content_type: contentType,
    content_id: contentId,
    reason,
    details: details?.trim() || null,
  });
}

export async function fetchReports({ status = null, contentType = null } = {}) {
  let q = supabase.from('reports').select('*, reporter:profiles!reporter_id(username, avatar_url)')
    .order('created_at', { ascending: false });
  if (status)      q = q.eq('status', status);
  if (contentType) q = q.eq('content_type', contentType);
  const { data } = await q;
  return data || [];
}

export async function updateReportStatus(reportId, status) {
  return supabase.from('reports').update({ status }).eq('id', reportId);
}

// ─── Moderation Queue ─────────────────────────────────────────────────────────

export async function fetchModerationQueue(status = 'pending', page = 0, pageSize = 20) {
  const { data, count } = await supabase
    .from('moderation_queue')
    .select('*, profiles!reviewed_by(username)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  return { items: data || [], count: count || 0 };
}

export async function resolveQueueItem(queueId, decision, contentType, contentId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;

  if (decision === 'approved') {
    // confirm hide: already hidden by trigger, just mark reviewed
  } else if (decision === 'rejected') {
    // restore content
    const table = contentType === 'post' ? 'posts'
      : contentType === 'comment' ? 'comments'
      : 'community_posts';
    await supabase.from(table).update({ hidden_at: null }).eq('id', contentId);
  }

  return supabase.from('moderation_queue').update({
    status: decision,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', queueId);
}

// Enfileira manualmente (ex: admin oculta via wordlist)
export async function enqueueContent(contentType, contentId, triggerType = 'wordlist') {
  return supabase.from('moderation_queue').insert({ content_type: contentType, content_id: contentId, trigger_type: triggerType });
}

// ─── Blocked Words ────────────────────────────────────────────────────────────

export async function fetchBlockedWords() {
  const { data } = await supabase.from('blocked_words').select('*').order('word');
  return data || [];
}

export async function addBlockedWord(word, severity = 'medium') {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  return supabase.from('blocked_words').insert({ word: word.trim().toLowerCase(), severity, created_by: userId });
}

export async function removeBlockedWord(wordId) {
  return supabase.from('blocked_words').delete().eq('id', wordId);
}

// ─── Violations ───────────────────────────────────────────────────────────────

export async function fetchViolations(userId = null, page = 0, pageSize = 20) {
  let q = supabase
    .from('violations')
    .select('*, user_profile:profiles!user_id(username, avatar_url), reviewer:profiles!reviewed_by(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (userId) q = q.eq('user_id', userId);
  const { data, count } = await q;
  return { items: data || [], count: count || 0 };
}

// Suspensão temporária (1 ou 7 dias). Bloqueia criar conteúdo via RLS.
export async function applySuspension(userId, days) {
  return supabase.rpc('apply_suspension', { p_user_id: userId, p_days: days });
}

export async function addViolation({ userId, contentType, contentId, reason, actionTaken, points, notes }) {
  const reviewerId = (await supabase.auth.getUser()).data.user?.id;
  return supabase.from('violations').insert({
    user_id: userId,
    content_type: contentType || null,
    content_id: contentId || null,
    reason: reason || null,
    action_taken: actionTaken,
    points: points ?? 1,
    reviewed_by: reviewerId,
    notes: notes?.trim() || null,
  });
}

// ─── Moderação IA (Fases 2 e 3 — HuggingFace) ────────────────────────────────

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

// Fire-and-forget: texto — não bloqueia o fluxo do usuário.
export async function moderateText(contentType, contentId, text) {
  if (!text?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, text }),
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

export async function hideContent(contentType, contentId) {
  const table = contentType === 'post' ? 'posts'
    : contentType === 'comment' ? 'comments'
    : 'community_posts';
  return supabase.from(table).update({ hidden_at: new Date().toISOString() }).eq('id', contentId);
}

export async function restoreContent(contentType, contentId) {
  const table = contentType === 'post' ? 'posts'
    : contentType === 'comment' ? 'comments'
    : 'community_posts';
  return supabase.from(table).update({ hidden_at: null }).eq('id', contentId);
}
