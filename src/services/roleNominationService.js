import { supabase } from '../lib/supabase';

const NOMINATION_SELECT = `
  id, target_role, status, eligibility_snapshot, review_notes,
  trial_started_at, trial_review_date, decided_at, created_at,
  candidate:profiles!staff_nominations_candidate_id_fkey(id, username, avatar_url, role),
  nominator:profiles!staff_nominations_nominated_by_fkey(id, username)
`;

const DEMOTION_SELECT = `
  id, previous_role, proposed_role, reason, status, review_notes, decided_at, created_at,
  target:profiles!role_change_requests_target_id_fkey(id, username, avatar_url, role),
  requester:profiles!role_change_requests_requested_by_fkey(id, username)
`;

export async function checkRoleEligibility(userId, targetRole = 'admin') {
  const { data, error } = await supabase.rpc('check_staff_eligibility', {
    p_user_id: userId, p_target_role: targetRole,
  });
  if (error) throw error;
  return data;
}

export async function fetchRoleNominations(statuses) {
  let query = supabase.from('staff_nominations').select(NOMINATION_SELECT).order('created_at', { ascending: false });
  if (statuses?.length) query = query.in('status', statuses);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchDemotionRequests(statuses) {
  let query = supabase.from('role_change_requests').select(DEMOTION_SELECT).order('created_at', { ascending: false });
  if (statuses?.length) query = query.in('status', statuses);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function nominateForRole(candidateId, targetRole) {
  const { data, error } = await supabase.rpc('nominate_staff', {
    p_candidate_id: candidateId, p_target_role: targetRole,
  });
  if (error) throw error;
  return data;
}

export async function reviewRoleNomination(nominationId, decision, notes) {
  const { error } = await supabase.rpc('review_staff_nomination', {
    p_nomination_id: nominationId, p_decision: decision, p_notes: notes || null,
  });
  if (error) throw error;
}

export async function decideRoleTrial(nominationId, decision, notes) {
  const { error } = await supabase.rpc('decide_staff_trial', {
    p_nomination_id: nominationId, p_decision: decision, p_notes: notes || null,
  });
  if (error) throw error;
}

export async function requestRoleDemotion(targetId, proposedRole, reason) {
  const { data, error } = await supabase.rpc('request_role_demotion', {
    p_target_id: targetId, p_proposed_role: proposedRole, p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function decideRoleDemotion(requestId, decision, notes) {
  const { error } = await supabase.rpc('decide_role_demotion', {
    p_request_id: requestId, p_decision: decision, p_notes: notes || null,
  });
  if (error) throw error;
}

export async function notifyOwner(message) {
  const { error } = await supabase.rpc('notify_owner', { p_message: message });
  if (error) throw error;
}
