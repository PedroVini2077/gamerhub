import { supabase } from '../lib/supabase';
import { from } from './result';

export async function changePassword(newPassword) {
  return from(await supabase.auth.updateUser({ password: newPassword }));
}

export async function changeEmail(newEmail) {
  return from(await supabase.auth.updateUser({ email: newEmail }));
}

/**
 * `[12/09]` Passou a exigir a SENHA, e a conferência é no servidor.
 *
 * Achado SEC-012: a ação mais destrutiva e irreversível do site acontecia atrás
 * de dois `ConfirmModal` — validação de cliente, que não vale nada quando a
 * `anon key` permite chamar a RPC direto. A versão sem senha foi APAGADA do
 * banco: deixá-la no ar manteria a porta aberta ao lado da nova.
 */
export async function deleteOwnAccount(senha) {
  return from(await supabase.rpc('delete_own_account', { p_senha: senha }));
}
