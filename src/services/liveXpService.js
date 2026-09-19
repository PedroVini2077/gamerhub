import { supabase } from '../lib/supabase';
import { ok, fail } from './result';

/**
 * XP das lives que JÁ ACONTECERAM — o alcance da moderação depois do cron.
 *
 * ── Por que passa por RPC e não por tabela ─────────────────────────────────
 *
 * `lives_realizadas` tem RLS ligada, **zero policies e zero grants**: nem
 * `anon` nem `authenticated` alcançam a tabela. Abrir a tabela para a equipe
 * daria leitura e escrita amplas a todo `authenticated` com cargo — o oposto
 * da régua de papéis. As três RPCs são `SECURITY DEFINER` e decidem no ato.
 *
 * ── O que o cliente NÃO decide aqui ───────────────────────────────────────
 *
 * Nada. `posso_moderar` vem do banco só para a tela não oferecer um botão que
 * vai falhar; a hierarquia é conferida de novo dentro de cada RPC, porque o
 * site usa a `anon key` e qualquer um chama a REST API direto (§1.3).
 */

/** Sessões de live, mais recentes primeiro. Só para `role_rank >= 2`. */
export async function listarLivesRealizadas(limite = 30) {
  const { data, error } = await supabase.rpc('listar_lives_realizadas', { p_limite: limite });
  if (error) return fail(error, []);
  return ok(data || []);
}

/** Tira o XP de uma live que já aconteceu. O motivo vai para a trilha e para o autor. */
export async function invalidarLiveRealizada(id, motivo) {
  const { error } = await supabase.rpc('invalidar_live_realizada', { p_id: id, p_motivo: motivo });
  if (error) return fail(error, null);
  return ok(null);
}

/**
 * A INVERSA. Só desfaz invalidação MANUAL — a automática (post oculto) volta
 * restaurando o post, e o banco recusa aqui dizendo isso. Duas portas para o
 * mesmo estado divergem.
 */
export async function revalidarLiveRealizada(id) {
  const { error } = await supabase.rpc('revalidar_live_realizada', { p_id: id });
  if (error) return fail(error, null);
  return ok(null);
}
