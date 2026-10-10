import { supabase } from '../lib/supabase';
import { ok, fail } from './result';

/**
 * `[10/10]` O REGISTRO de desbloqueio das conquistas.
 *
 * ── O que esta camada faz, e o que ela deliberadamente NÃO faz ──────────────
 *
 * Ela registra e lê. **Ela não decide se a conquista está concluída** — isso
 * continua sendo a avaliação derivada de `lib/conquistas.js`, que é a única
 * fonte do progresso na tela. O que vem daqui é a DATA.
 *
 * Trocar a origem do "concluída" para esta tabela é a decisão pendente nº 1 do
 * estudo de cosméticos (*desbloqueio permanente ou condicional?*), e é do dono.
 *
 * ── A conta de escrita, porque é ela que justificou a tabela (§0.2) ─────────
 *
 * `registrar_conquistas()` é chamada uma vez por visita ao PRÓPRIO perfil, e
 * só escreve o que ainda não tem registro. Depois da primeira vez ela devolve
 * `0` e não escreve nada. Teto: **8 linhas por conta, na vida inteira** — não
 * uma por post, curtida e comentário, que foi o desenho recusado em 05/09.
 *
 * ── Por que a RPC não recebe parâmetro ─────────────────────────────────────
 *
 * O site usa a `anon key` (§1.3). Se ela aceitasse `p_conquista_id`, qualquer
 * pessoa logada se daria todas as conquistas com um `POST` no `/rest/v1/rpc/`.
 * Ela mede do zero no servidor, para `auth.uid()`, e por isso não há o que
 * forjar — nem é possível registrar conquista de outra pessoa.
 */

/**
 * Registra o que a pessoa logada cumpriu e ainda não tinha registro.
 *
 * @returns {Promise<{data: number, error: object|null}>}
 *          `data` = quantas linhas entraram. **`0` é o caso normal** depois da primeira
 *          vez, e é resposta — não silêncio: é o único jeito de quem estiver
 *          testando distinguir "funcionou e não havia nada novo" de "não
 *          funcionou" (§1.5, a lição do fire-and-forget da moderação por IA).
 */
export async function registrarConquistas() {
  const { data, error } = await supabase.rpc('registrar_conquistas');
  // Vazio seguro 0: falhar em registrar nao pode derrubar o perfil, e a
  // tela so perde a data.
  if (error) return fail(error, 0);
  return ok(typeof data === 'number' ? data : 0);
}

/**
 * Lê os registros da pessoa logada, já no formato que a avaliação espera.
 *
 * A RLS resolve o recorte: a policy é `user_id = auth.uid()`, então não há
 * filtro no cliente para alguém esquecer. **Isto não é a mesma coisa** que
 * confiar no cliente — é a defesa estar no lugar certo.
 *
 * @returns {Promise<{data: object, error: object|null}>}
 *          `data` = `{ [conquista_id]: { desbloqueada_em, retroativa } }`
 */
export async function lerConquistasDesbloqueadas() {
  const { data, error } = await supabase
    .from('conquistas_desbloqueadas')
    // Colunas nomeadas e não `*`: egress é a cota mais apertada do Supabase
    // (§6.1), e `user_id` não serve para nada na tela — a RLS já garantiu de
    // quem é.
    .select('conquista_id, desbloqueada_em, retroativa');

  if (error) return fail(error, {});

  const mapa = {};
  for (const linha of data ?? []) {
    mapa[linha.conquista_id] = {
      desbloqueada_em: linha.desbloqueada_em,
      retroativa: linha.retroativa,
    };
  }
  return ok(mapa);
}
