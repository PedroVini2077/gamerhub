import { supabase } from '../lib/supabase';

export async function changePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function changeEmail(newEmail) {
  return supabase.auth.updateUser({ email: newEmail });
}

export async function deleteOwnAccount() {
  return supabase.rpc('delete_own_account');
}
