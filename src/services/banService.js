import { supabase } from '../lib/supabase';
import { from } from './result';

/**
 * Pedido de revisão aberto pela PRÓPRIA pessoa banida.
 *
 * Até 28/08/2026 isto não existia: a `BannedScreen` mostrava o motivo e
 * deslogava, e `request_unban` exigia cargo de staff — ou seja, só um admin
 * abria o pedido em nome de alguém. Era uma porta que só abria de um lado, e
 * quem tomou ban por engano não tinha a quem recorrer nem sabia a quem.
 *
 * Todas as regras vivem no banco (`solicitar_revisao_do_proprio_ban`), não
 * aqui: um pedido por banimento, mínimo de 20 e máximo de 1000 caracteres,
 * e só quem está de fato banido. O site entrega a `anon key`, então qualquer
 * checagem que só existisse nesta função seria contornável chamando a REST
 * API direto (`CLAUDE.md` §1.3).
 *
 * A mensagem de erro do banco já vem em português e explicando o caso — quem
 * chama deve repassá-la, não substituí-la por um "erro ao enviar" genérico.
 */
export async function solicitarRevisaoDoProprioBan(motivo) {
  return from(await supabase.rpc('solicitar_revisao_do_proprio_ban', {
    p_motivo: motivo?.trim() ?? '',
  }));
}

/**
 * Pedido aberto por um membro da equipe em nome de alguém banido.
 *
 * Estava sendo chamada direto de dentro do `UnbanRequestModal`, contra a regra
 * de "acesso ao Supabase mora no service do domínio" (§4).
 */
export async function solicitarDesbanimento(userId, motivo) {
  return from(await supabase.rpc('request_unban', {
    p_user_id: userId,
    p_reason: motivo?.trim() ?? '',
  }));
}
