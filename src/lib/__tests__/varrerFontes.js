/**
 * Varredor de arquivos para as travas que leem o código-fonte.
 *
 * ── Por que ele existe ──────────────────────────────────────────────────────
 *
 * A varredura de classe de 02/09 encontrou **6 de 9** travas que leem arquivos
 * sem conferir que leram **algum**. Todas seguiam o mesmo desenho:
 *
 *     const arquivos = varrer('src/algum/caminho');   // e se voltar vazio?
 *     const infratores = arquivos.filter(...);
 *     expect(infratores).toEqual([]);                 // passa. sempre.
 *
 * Se a pasta for renomeada, a lista chega vazia, o filtro não acha nada, e o
 * teste fica **verde para sempre** — sem nunca mais ter olhado uma linha. É a
 * classe "teste que não consegue falhar", que já me pegou duas vezes: na trava
 * de portas RPC e na de banco fora do ar.
 *
 * A guarda mora AQUI e não em cada teste de propósito: guarda que depende de
 * alguém lembrar de escrever é a mesma coisa que não ter guarda.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lista os arquivos de código de um diretório, recursivamente.
 *
 * **Estoura se não achar nada.** Diretório vazio ou inexistente é sempre erro
 * de teste — nenhuma pasta varrida por trava deste projeto é legitimamente
 * vazia. Falhar alto aqui é o oposto de passar em silêncio.
 *
 * @param {string} dir           por onde começar
 * @param {object} [opcoes]
 * @param {RegExp} [opcoes.extensoes]  o que conta como código
 * @param {boolean} [opcoes.comTestes] incluir `__tests__` (padrão: não)
 */
export function varrerFontes(dir, {
  extensoes = /\.(js|jsx)$/, comTestes = false,
} = {}) {
  const achados = coletar(dir, extensoes, comTestes);

  if (achados.length === 0) {
    throw new Error(
      `varrerFontes("${dir}") nao encontrou arquivo nenhum.\n`
      + '  A pasta foi renomeada ou movida? Sem esta guarda, a trava que chamou\n'
      + '  esta funcao passaria VERDE para sempre, sem nunca mais olhar uma\n'
      + '  linha de codigo — que e o pior tipo de teste que existe.\n'
      + '  Corrija o caminho, ou apague a trava se ela deixou de fazer sentido.');
  }
  return achados;
}

function coletar(dir, extensoes, comTestes) {
  let nomes;
  try { nomes = readdirSync(dir); } catch { return []; }

  return nomes.flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (!comTestes && nome === '__tests__') return [];
      return coletar(caminho, extensoes, comTestes);
    }
    return extensoes.test(nome) ? [caminho] : [];
  });
}
