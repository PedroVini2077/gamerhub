import { supabase } from '../lib/supabase';
import { ok, fail } from './result';

/**
 * `[26/09]` O RADAR DE PAUTAS — de onde vêm as ideias.
 *
 * ── O que a verificação dele mostrou ──────────────────────────────────────
 *
 * Ele pediu que a IA desse *"as ideias, as fontes confiáveis, às vezes o
 * título"*, e pediu para eu **verificar se dá** antes. Dá — mas não
 * perguntando ao modelo o que aconteceu hoje: LLM não tem internet e tem data
 * de corte, então ele responderia com treino velho ou inventaria. Notícia
 * inventada com cara de fonte confiável é o pior resultado possível aqui.
 *
 * O que o servidor faz: lê o RSS das fontes que a equipe cadastrou, e só então
 * pede ao modelo para **ordenar e sugerir** em cima daquelas manchetes. O fato
 * vem do feed; a leitura editorial vem do modelo. Mesma regra da
 * `redigir-materia` — ele redige, não apura.
 *
 * ── Por que o erro NÃO vira exceção aqui ──────────────────────────────────
 *
 * Quando o modelo falha, a **coleta continua valendo**: a função devolve
 * `itens` com as manchetes cruas e uma frase dizendo o que aconteceu. Tratar
 * isso como falha total jogaria fora trabalho que deu certo — e deixaria o
 * editor sem nada, quando ele poderia ler as manchetes na mão.
 */

/**
 * Busca pautas: coleta as fontes e devolve a leitura editorial.
 *
 * @returns {Promise<{data: object|null, error: object|null}>}
 *   `data` traz `{ status, pautas, itens, coletados, comFalha, aviso }`.
 *   `pautas` pode vir vazia com `itens` cheio — é o caso de a IA ter falhado
 *   e a coleta não.
 */
export async function buscarPautas() {
  const { data, error } = await supabase.functions.invoke('radar-de-pautas', { body: {} });

  if (error) {
    const corpo = await error?.context?.json?.().catch(() => null);
    return fail({ message: corpo?.error ?? 'O radar não respondeu. Tente de novo em um minuto.' });
  }

  return ok({
    status:   data?.status ?? 'ok',
    pautas:   Array.isArray(data?.pautas) ? data.pautas : [],
    itens:    Array.isArray(data?.itens) ? data.itens : [],
    coletados: data?.coletados ?? 0,
    fontes:    data?.fontes ?? 0,
    comFalha:  Array.isArray(data?.comFalha) ? data.comFalha : [],
    descartados: data?.enderecosDescartados ?? 0,
    // O `error` do corpo NÃO é falha: é o aviso de que uma das duas metades
    // não aconteceu. Ele vai para a tela como aviso, não como erro vermelho.
    aviso: data?.error ?? null,
  });
}
