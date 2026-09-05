import { supabase } from '../lib/supabase';
import { from } from './result';
import { aceitesParaGravar } from '../lib/documentosLegais';

/**
 * Registrar que a pessoa aceitou os documentos — a PROVA, não a caixinha.
 *
 * ── Por que isto não pode falhar em silêncio, e por que também não pode
 *    derrubar o cadastro ────────────────────────────────────────────────────
 *
 * São dois riscos opostos, e os dois são reais:
 *
 * - engolir o erro deixaria uma conta criada **sem registro de aceite**, e o
 *   registro é a única coisa que prova o consentimento. Silêncio aqui é §1.5;
 * - estourar derrubaria a criação da conta por causa de uma linha de auditoria,
 *   depois de o usuário já existir no `auth.users`. A pessoa ficaria com uma
 *   conta pela metade e uma mensagem de erro que não explica nada.
 *
 * A saída é devolver o resultado para quem chamou decidir — e quem chama
 * (`useAuth.signUp`) avisa na tela sem impedir a entrada.
 *
 * ── Idempotente de propósito ────────────────────────────────────────────────
 *
 * `upsert` com `ignoreDuplicates`: reaceitar a MESMA versão não cria linha
 * nova nem devolve erro, porque a tabela tem `UNIQUE (user_id, documento,
 * versao)`. Aceitar uma versão NOVA cria — que é exatamente o histórico que a
 * gente quer guardar.
 */
export async function registrarAceiteDosDocumentos(userId) {
  if (!userId) {
    return { data: null, error: new Error('Sem usuario para registrar o aceite.') };
  }
  return from(await supabase
    .from('policy_acceptances')
    .upsert(aceitesParaGravar(userId), {
      onConflict: 'user_id,documento,versao',
      ignoreDuplicates: true,
    }));
}

/**
 * O que esta pessoa já aceitou. A RLS limita ao próprio usuário (ou à equipe),
 * então isto não precisa — e não deve — repetir a checagem: repetir criaria a
 * ilusão de que a proteção mora aqui.
 */
export async function meusAceites() {
  return from(await supabase
    .from('policy_acceptances')
    .select('documento, versao, aceito_em')
    .order('aceito_em', { ascending: false }), []);
}
