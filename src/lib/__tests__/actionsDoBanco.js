/**
 * Extrai das MIGRATIONS toda `action` que o banco grava em `admin_logs`.
 *
 * ── Por que isto existe ─────────────────────────────────────────────────────
 *
 * Action gravada por função do Postgres não aparece como texto em `src/`, então
 * a varredura do código-fonte nunca a vê — e ela chega no painel de trilha com
 * o ícone genérico, sem nada estourar.
 *
 * Até 05/09 isso era coberto por uma lista escrita à mão em `logMeta.js`. A
 * Fase 4 da auditoria encontrou **onze** actions vivas fora dela. O problema não
 * era a lista estar errada: era ela **precisar ser lembrada**, que é a mesma
 * classe de falha que ela deveria resolver.
 *
 * ── Por que ler por POSIÇÃO DE COLUNA, e não por regex de literal ───────────
 *
 * A primeira tentativa foi pegar todo literal perto de `admin_logs`. Ela
 * devolveu 44 achados, dos quais **21 eram lixo** — nomes de coluna, chaves de
 * jsonb (`reason`, `tamanho`, `contact_id`) e categorias. Trava que grita por
 * falso positivo vira ruído, e ruído ensina a ignorar o canal (§0.2).
 *
 * Então este módulo faz o que o Postgres faz: lê a lista de colunas do INSERT,
 * acha em que posição está `action`, e pega o valor daquela posição. As duas
 * formas usadas neste banco entram:
 *
 *     insert into admin_logs (action, details, ...)      values ('x', ...)
 *     insert into admin_logs (admin_id, ..., action, ...) values (v_id, ..., 'x', ...)
 *
 * ── O buraco que sobra, dito com todas as letras ────────────────────────────
 *
 * `CREATE OR REPLACE` aplicado direto no Supabase, sem passar pelo repositório,
 * escapa daqui. É o mesmo buraco que o README de `supabase/migrations` já
 * descreve, e a resposta é a mesma: migration que não está lá não existe.
 */
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'supabase/migrations';

/**
 * Divide uma lista de argumentos SQL pelas vírgulas de PRIMEIRO nível.
 *
 * Vírgula dentro de parênteses (`coalesce(a, b)`) ou dentro de aspas
 * (`'oi, tudo bem'`) não separa nada — e as duas aparecem de verdade nestes
 * INSERTs. Aspas simples duplicadas (`''`) são escape, não fim de texto.
 */
function separarArgumentos(texto) {
  const partes = [];
  let atual = '';
  let profundidade = 0;
  let dentroDeTexto = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (dentroDeTexto) {
      if (c === "'" && texto[i + 1] === "'") { atual += "''"; i++; continue; }
      if (c === "'") dentroDeTexto = false;
      atual += c;
      continue;
    }

    if (c === "'") { dentroDeTexto = true; atual += c; continue; }
    if (c === '(') profundidade++;
    if (c === ')') profundidade--;
    if (c === ',' && profundidade === 0) { partes.push(atual.trim()); atual = ''; continue; }
    atual += c;
  }
  partes.push(atual.trim());
  return partes;
}

/**
 * Os literais que o banco grava numa COLUNA de uma TABELA.
 *
 * Genérico de propósito: o mesmo defeito — mapa do JS sem a chave que o banco
 * produz — apareceu em `admin_logs.action` **e** em `admin_notifications.type`,
 * nos dois casos com ícone genérico e nada estourando. Fechar o caso e deixar o
 * irmão aberto é exatamente o erro que a Fase 4 existe para não repetir.
 *
 * Estoura se a pasta sumir ou vier vazia: sem isso, renomear o diretório
 * deixaria a trava que usa esta lista verde para sempre, sem nunca mais ter
 * olhado uma linha — que é o pior tipo de teste que existe.
 */
export function literaisGravadosPeloBanco(tabela, coluna) {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
  if (arquivos.length === 0) {
    throw new Error(
      `${DIR} nao tem migration nenhuma. A pasta foi movida?\n`
      + '  Sem esta guarda, a trava de icones passaria verde para sempre.');
  }

  const achadas = new Set();
  const INSERT = new RegExp(
    `insert\\s+into\\s+(?:public\\.)?${tabela}\\s*\\(([^)]*)\\)\\s*values\\s*\\(`, 'gi');

  for (const arquivo of arquivos) {
    const sql = readFileSync(`${DIR}/${arquivo}`, 'utf8');

    for (const m of sql.matchAll(INSERT)) {
      const colunas = m[1].split(',').map((c) => c.trim().toLowerCase());
      const posicao = colunas.indexOf(coluna);
      if (posicao === -1) continue;

      // Do fim do `values (` até o parêntese que o fecha, contando profundidade.
      const inicio = m.index + m[0].length;
      let profundidade = 1;
      let dentroDeTexto = false;
      let fim = inicio;
      while (fim < sql.length && profundidade > 0) {
        const c = sql[fim];
        if (dentroDeTexto) {
          if (c === "'" && sql[fim + 1] === "'") fim++;
          else if (c === "'") dentroDeTexto = false;
        } else if (c === "'") dentroDeTexto = true;
        else if (c === '(') profundidade++;
        else if (c === ')') profundidade--;
        fim++;
      }

      const valores = separarArgumentos(sql.slice(inicio, fim - 1));
      const valor = valores[posicao];

      // Só literal interessa. `v_action`, `case ... end` e afins são dinâmicos —
      // o banco decide em tempo de execução, e adivinhar ali seria chute.
      const literal = valor && /^'([a-z][a-z0-9_]{2,40})'$/.exec(valor.trim());
      if (literal) achadas.add(literal[1]);
    }
  }

  return [...achadas].sort();
}

/** As `action` de `admin_logs` — o painel de trilha. */
export const actionsDoBanco = () => literaisGravadosPeloBanco('admin_logs', 'action');

/** Os `type` de `admin_notifications` — o sino da equipe. */
export const tiposDeNotificacaoDoBanco = () =>
  literaisGravadosPeloBanco('admin_notifications', 'type');
