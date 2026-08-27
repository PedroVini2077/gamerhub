import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_LABEL, FONTE_DO_CONTEUDO, TABELA_DO_AUTOR,
} from '../../components/moderation/queueLabels';

/**
 * Trava do "ritual de publicar conteúdo" (CLAUDE.md §1.5 e §2).
 *
 * ── O problema que ela impede ──────────────────────────────────────────────
 *
 * Criar conteúdo neste site é um ritual repetido À MÃO em quatro lugares
 * (`usePostComposer`, `MuralForm`, `useLiveChat`, `CommentSection`):
 *
 *     useBlockedWords → checkContent → suspendedUntil → moderateText(TIPO, …)
 *
 * Nada garante que um 5º tipo de conteúdo lembre de todos os passos, nem que o
 * tipo novo exista nos mapas que a fila de moderação consulta. Já quebrou: o
 * tipo `chat` chegou na fila sem existir em nenhum mapa, caiu num
 * `else → community_posts`, foi buscar numa tabela onde a linha nunca existe,
 * o erro foi descartado, e o card ficou em "Carregando..." para sempre.
 *
 * Ninguém escreveu esse bug — ele NASCEU no dia em que um valor novo apareceu.
 *
 * ── Por que um teste, e não uma refatoração ────────────────────────────────
 *
 * O backlog cogitava extrair o ritual num hook só. Ao olhar os quatro pontos,
 * eles NÃO são iguais: post modera texto + imagem + link; mural, texto e
 * imagem; chat e comentário só texto. E o aviso de suspensão mora em camadas
 * diferentes (`PostForm` para post, `ChatPanel` para chat, o próprio form nos
 * outros). Forçar os quatro num molde só exigiria parametrizar tanto que a
 * abstração custaria mais do que o problema — e os quatro funcionam hoje.
 *
 * O que faltava não era organização: era o CONTRATO ser conferido. É isto.
 *
 * ── O que ela confronta ────────────────────────────────────────────────────
 *
 * Três lugares que precisam concordar para sempre, em lados opostos do sistema:
 *
 *   1. `FONTES` na Edge Function `moderate-text` — de onde ela lê o texto
 *   2. os mapas de `queueLabels.js` — como a fila mostra e resolve o item
 *   3. os `moderateText('tipo', …)` espalhados pelo `src/` — quem produz
 *
 * Só dá para fazer isto porque as Edge Functions foram versionadas em 27/08.
 * Antes, o lado do servidor não existia no repositório para ser comparado.
 */

const RAIZ = join(import.meta.dirname, '../..');
const EDGE = join(import.meta.dirname, '../../../supabase/functions/moderate-text/index.ts');

/** Os tipos que a Edge Function sabe ler, extraídos do mapa `FONTES`. */
function tiposDaEdgeFunction() {
  const src = readFileSync(EDGE, 'utf8');
  const bloco = src.match(/const FONTES[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!bloco) return [];
  return [...bloco[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map(m => m[1]);
}

function arquivosDeCodigo(dir) {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      return nome === '__tests__' ? [] : arquivosDeCodigo(caminho);
    }
    return /\.jsx?$/.test(nome) ? [caminho] : [];
  });
}

/** Todo `moderateText('x', …)` / `moderateImages('x', …)` do código, com o arquivo. */
function tiposProduzidosPeloCodigo() {
  const achados = new Map();
  for (const caminho of arquivosDeCodigo(RAIZ)) {
    const src = readFileSync(caminho, 'utf8');
    const relativo = caminho.slice(RAIZ.length + 1);
    for (const m of src.matchAll(/moderate(?:Text|Images|Links)\(\s*'(\w+)'/g)) {
      if (!achados.has(m[1])) achados.set(m[1], relativo);
    }
  }
  return achados;
}

describe('tipos de conteúdo — o contrato entre quem produz e quem modera', () => {
  const naEdge = tiposDaEdgeFunction();
  const produzidos = tiposProduzidosPeloCodigo();

  it('acha os tipos dos dois lados (guarda contra o regex quebrar)', () => {
    expect(naEdge, 'não consegui ler FONTES da Edge Function').toContain('post');
    expect(naEdge.length).toBeGreaterThanOrEqual(4);
    expect(produzidos.size).toBeGreaterThanOrEqual(4);
  });

  it('todo tipo que o código produz existe na Edge Function', () => {
    const orfaos = [...produzidos]
      .filter(([tipo]) => !naEdge.includes(tipo))
      .map(([tipo, arquivo]) => `${tipo} (${arquivo})`);

    expect(orfaos, orfaos.length
      ? 'Estes tipos são mandados para moderação e a Edge Function não sabe ler.\n'
        + 'Ela devolve 400 e o conteúdo passa SEM ANÁLISE, em silêncio.\n'
        + 'Acrescente em supabase/functions/moderate-text/index.ts, no mapa FONTES:\n  '
        + orfaos.join('\n  ')
      : undefined).toEqual([]);
  });

  it('todo tipo da Edge Function existe nos três mapas da fila', () => {
    const faltando = [];
    for (const tipo of naEdge) {
      const ausentes = [
        !(tipo in CONTENT_LABEL)      && 'CONTENT_LABEL',
        !(tipo in FONTE_DO_CONTEUDO)  && 'FONTE_DO_CONTEUDO',
        !(tipo in TABELA_DO_AUTOR)    && 'TABELA_DO_AUTOR',
      ].filter(Boolean);
      if (ausentes.length) faltando.push(`${tipo} — falta em ${ausentes.join(', ')}`);
    }

    expect(faltando, faltando.length
      ? 'Tipo que chega na fila de moderação sem ter mapa. Foi exatamente assim\n'
        + 'que o `chat` caiu num else e o card ficou em "Carregando..." para\n'
        + 'sempre. Acrescente em src/components/moderation/queueLabels.js:\n  '
        + faltando.join('\n  ')
      : undefined).toEqual([]);
  });

  it('os três mapas da fila cobrem exatamente os mesmos tipos entre si', () => {
    const chaves = o => Object.keys(o).sort();
    expect(chaves(FONTE_DO_CONTEUDO), 'FONTE_DO_CONTEUDO divergiu de CONTENT_LABEL')
      .toEqual(chaves(CONTENT_LABEL));
    expect(chaves(TABELA_DO_AUTOR), 'TABELA_DO_AUTOR divergiu de CONTENT_LABEL')
      .toEqual(chaves(CONTENT_LABEL));
  });

  it('cada tipo tem uma tabela, e a mesma nos dois mapas que a citam', () => {
    // `FONTE_DO_CONTEUDO` (a prévia lê daqui) e `TABELA_DO_AUTOR` (o ban lê
    // daqui) apontam para a mesma linha. Divergir aqui significa banir a
    // pessoa errada, ou não achar ninguém.
    for (const [tipo, fonte] of Object.entries(FONTE_DO_CONTEUDO)) {
      expect(TABELA_DO_AUTOR[tipo],
        `${tipo}: a prévia lê de "${fonte.tabela}" mas o autor é procurado em `
        + `"${TABELA_DO_AUTOR[tipo]}" — um dos dois está errado`,
      ).toBe(fonte.tabela);
    }
  });
});
