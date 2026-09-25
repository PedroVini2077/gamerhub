import { supabase } from '../lib/supabase';
import { ok, fail } from './result';
import { MINIMO_DE_NOTAS } from '../lib/news/rascunhoDeIa';

/**
 * `[25/09]` A chamada da IA que RASCUNHA a matéria.
 *
 * ── Por que Edge Function e não daqui ─────────────────────────────────────
 *
 * A chave do provedor não pode existir no navegador. O site usa a `anon key` e
 * tudo que chega ao cliente é público — pôr uma chave de IA aqui seria entregar
 * a cota do projeto para quem abrisse o DevTools.
 *
 * ── O que esta função NÃO faz ─────────────────────────────────────────────
 *
 * Não escreve no banco. A Edge Function devolve o rascunho, a tela mostra, e
 * **só o clique do editor aplica**. É a mesma regra do resto do assistente:
 * sugestão é oferta, e quem aplica é quem assina.
 */

/**
 * Pede um rascunho a partir das NOTAS do editor.
 *
 * @param {{titulo?: string, notas: string, fonteUrl?: string}} entrada
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
export async function rascunharComIa({ titulo, notas, fonteUrl }) {
  if (!notas?.trim() || notas.trim().length < MINIMO_DE_NOTAS) {
    return fail({
      message: 'Escreva as notas primeiro — o que você apurou, colou ou leu. '
             + 'A IA redige a partir delas; ela não sabe nada sobre o assunto.',
    });
  }

  const { data, error } = await supabase.functions.invoke('redigir-materia', {
    body: { titulo, notas, fonte_url: fonteUrl },
  });

  // `functions.invoke` embrulha o erro HTTP, e o corpo com a mensagem em
  // português fica dentro dele. Deixar só "FunctionsHttpError" chegar na tela
  // seria trocar uma frase útil por jargão (§1.5).
  if (error) {
    const corpo = await error?.context?.json?.().catch(() => null);
    return fail({ message: corpo?.error ?? 'A IA não respondeu. Tente de novo em um minuto.' });
  }
  if (data?.status !== 'ok') {
    return fail({ message: data?.error ?? 'A IA não devolveu um rascunho.' });
  }
  return ok(data.rascunho);
}

/**
 * Reexportado para a tela não precisar importar dois módulos. A regra mora em
 * `lib/news/rascunhoDeIa.js` porque é pura — ver o cabeçalho de lá.
 */
export { MINIMO_DE_NOTAS, MARCADOR_DE_LACUNA, lacunasDoRascunho } from '../lib/news/rascunhoDeIa';
