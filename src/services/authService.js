import { supabase } from '../lib/supabase';
import { from } from './result';

export async function changePassword(newPassword) {
  return from(await supabase.auth.updateUser({ password: newPassword }));
}

export async function changeEmail(newEmail) {
  return from(await supabase.auth.updateUser({ email: newEmail }));
}

export async function deleteOwnAccount() {
  return from(await supabase.rpc('delete_own_account'));
}
