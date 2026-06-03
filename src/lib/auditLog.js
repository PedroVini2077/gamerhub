import { supabase } from './supabase';

export async function logAudit(action, details, options = {}) {
  const { category = 'auth', severity = 'info', metadata = null } = options;
  try {
    await supabase.rpc('log_audit_event', {
      p_action: action,
      p_details: details,
      p_category: category,
      p_severity: severity,
      p_metadata: metadata,
    });
  } catch {
    // logging nunca deve quebrar o fluxo principal
  }
}

export async function logSecurity(action, details, email, attempts, metadata = null) {
  try {
    await supabase.rpc('log_security_event', {
      p_action: action,
      p_details: details,
      p_email: email || null,
      p_attempts: attempts || 0,
      p_metadata: metadata,
    });
  } catch {
    // idem
  }
}
