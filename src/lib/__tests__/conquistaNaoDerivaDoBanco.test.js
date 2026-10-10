import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CONQUISTAS } from '../conquistas';
import { textoVisivel } from '../textoVisivel';

/**
 * `[10/10]` AS CONQUISTAS AGORA EXISTEM NOS DOIS LADOS — e os dois têm de
 * concordar.
 *
 * ── Por que a duplicação é inevitável aqui ─────────────────────────────────
 *
 * O site usa a `anon key` (§1.3), então uma RPC que aceitasse
 * `p_conquista_id` daria a qualquer pessoa logada todas as conquistas com um
 * `POST` no `/rest/v1/rpc/`. A consequência é que **o servidor tem de medir**,
 * e medir exige conhecer as metas. Elas passam a existir em `CONQUISTAS` (JS,
 * que desenha a tela) e em `medir_conquistas` (SQL, que autoriza o registro).
 *
 * Isso é deriva por construção — a FASE 4 do §6 — e a resposta do projeto para
 * deriva é trava de contrato, não confiança.
 *
 * ── O lado MUDO, que é o que justifica a trava ──────────────────────────────
 *
 * Se o JS ganhar uma conquista que o SQL não conhece, ela aparece na tela,
 * fica concluída pela medição derivada, e **nunca recebe data** — porque a RPC
 * nunca a registra. Nada estoura, nada loga, e o card parece funcionar.
 *
 * Se o SQL ganhar uma que o JS não conhece, ela é gravada e nunca aparece:
 * linha morta num append-only, que é o pior lugar para lixo.
 *
 * E se a META divergir — 10 posts no JS, 5 no SQL — a tela mostra a barra em
 * 50% para uma conquista que já tem registro e data. Esse é o caso que mais
 * engana, porque os dois lados funcionam.
 */

const PASTA = 'supabase/migrations';

/** Todas as migrations, sem comentário — comentário cita nome e engana regex. */
const SQL = (() => {
  const nomes = readdirSync(PASTA).filter((n) => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes
    .map((n) => readFileSync(join(PASTA, n), 'utf8')
      .replace(/--[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' '))
    .join('\n');
})();

/** A ÚLTIMA definição de `medir_conquistas` — é a que vale hoje. */
const medir = (() => {
  const m = SQL.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?medir_conquistas[\s\S]*?\$fn\$[\s\S]*?\$fn\$/gi);
  return m ? m[m.length - 1] : '';
})();

/** A ÚLTIMA definição de `registrar_conquistas`. */
const registrar = (() => {
  const m = SQL.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?registrar_conquistas[\s\S]*?\$fn\$[\s\S]*?\$fn\$/gi);
  return m ? m[m.length - 1] : '';
})();

/**
 * O mapa `id -> meta` do SQL, lido do bloco `VALUES`.
 *
 * **Por linha, e não por regex de tupla.** A 1ª versão era
 * `\('([a-z_]+)',[^)]*?,\s*(\d+)\s*\)` e devolvia **zero** conquistas: o
 * `[^)]*?` não atravessa o `)` do `COALESCE((SELECT …), 0)` que cada linha tem
 * no meio. Quem acusou foi a guarda de vacuidade — sem ela, esta trava teria
 * passado verde comparando um mapa vazio com outro.
 *
 * Aqui a linha é a unidade: o id é o primeiro literal, a meta é o **último
 * número** antes do fecho. `VALUES` não tem nome de coluna, então posição é o
 * que há — e é exatamente por isso que a guarda existe.
 */
const metasDoSql = (() => {
  const mapa = {};
  for (const linha of medir.split('\n')) {
    const id = linha.match(/^\s*\('([a-z_]+)'\s*,/);
    if (!id) continue;
    const numeros = linha.match(/(\d+)\s*\)\s*,?\s*$/);
    if (numeros) mapa[id[1]] = Number(numeros[1]);
  }
  return mapa;
})();

const metasDoJs = Object.fromEntries(CONQUISTAS.map((c) => [c.id, c.meta]));

describe('as conquistas não derivam entre o JS e o banco', () => {
  it('a migration foi LIDA e o mapa do SQL foi extraído', () => {
    // Vacuidade: se o formato do `VALUES` mudar, `metasDoSql` vem vazio e
    // todas as comparações abaixo passariam verdes sem comparar nada.
    expect(medir, [
      '`medir_conquistas` não foi encontrada nas migrations.',
      '',
      'Ela é quem o servidor usa para decidir o que registrar. Sem ela, o',
      'registro de desbloqueio não existe — e esta trava não tem o que comparar.',
    ].join('\n')).toBeTruthy();

    expect(Object.keys(metasDoSql).length, [
      'Não consegui extrair nenhuma conquista do bloco `VALUES` de',
      '`medir_conquistas`. O formato mudou.',
      '',
      'Isto é a guarda de vacuidade: sem ela, a comparação de conjuntos abaixo',
      'ficaria verde para sempre comparando dois vazios.',
    ].join('\n')).toBeGreaterThan(1);
  });

  it('o SQL conhece exatamente as mesmas conquistas que o JS', () => {
    const soNoJs  = Object.keys(metasDoJs).filter((id) => !(id in metasDoSql));
    const soNoSql = Object.keys(metasDoSql).filter((id) => !(id in metasDoJs));

    expect({ soNoJs, soNoSql }, [
      'A lista de conquistas divergiu entre a tela e o banco.',
      '',
      soNoJs.length ? `Só no JS (${soNoJs.join(', ')}): aparece na tela, fica`
        + ' concluída pela medição derivada e NUNCA recebe data, porque a RPC não'
        + ' a registra. Nada estoura.' : '',
      soNoSql.length ? `Só no SQL (${soNoSql.join(', ')}): é gravada e nunca`
        + ' aparece — linha morta num append-only.' : '',
      '',
      'Acrescentar conquista exige os DOIS lados: o objeto em',
      '`src/lib/conquistas.js` e a linha no `VALUES` de `medir_conquistas`.',
    ].filter(Boolean).join('\n')).toEqual({ soNoJs: [], soNoSql: [] });
  });

  it('as METAS batem, uma por uma', () => {
    const divergentes = Object.keys(metasDoJs)
      .filter((id) => id in metasDoSql && metasDoJs[id] !== metasDoSql[id])
      .map((id) => `${id}: JS=${metasDoJs[id]} SQL=${metasDoSql[id]}`);

    expect(divergentes, [
      'A meta de alguma conquista divergiu entre a tela e o banco:',
      ...divergentes.map((d) => `  - ${d}`),
      '',
      'Este é o caso que mais engana, porque os DOIS lados continuam',
      'funcionando: a barra mostra 50% para uma conquista que já tem registro',
      'e data gravados, ou mostra concluída uma que nunca será registrada.',
    ].join('\n')).toEqual([]);
  });

  it('a RPC que o cliente chama NÃO aceita parâmetro', () => {
    // A propriedade de segurança inteira mora aqui. Com um `p_conquista_id`,
    // qualquer pessoa logada se dá todas as conquistas pela REST API — o site
    // usa a `anon key` e o cliente não é fonte de verdade (§1.3).
    const assinatura = (registrar.match(/registrar_conquistas\s*\(([^)]*)\)/) || [])[1];

    expect(assinatura, [
      'Não achei a assinatura de `registrar_conquistas`.',
    ].join('\n')).toBeDefined();

    expect(assinatura.trim(), [
      '`registrar_conquistas` passou a aceitar parâmetro.',
      '',
      `Assinatura encontrada: (${assinatura})`,
      '',
      'Isso desliga a proteção inteira. O site usa a `anon key`: qualquer pessoa',
      'logada chama `/rest/v1/rpc/registrar_conquistas` direto e nomeia a',
      'conquista que quiser. A função tem de MEDIR, do zero, para `auth.uid()`.',
    ].join('\n')).toBe('');
  });

  it('a RPC grava `retroativa = false`, e só o backfill grava `true`', () => {
    // Se a RPC gravasse `true`, nenhuma conquista teria data — nunca, para
    // ninguém —, e a tela ficaria exatamente igual à de antes da tabela: o
    // mecanismo inteiro funcionando e não entregando nada (§1.5).
    expect(/retroativa\s*\)?[\s\S]{0,200}?false/.test(registrar), [
      '`registrar_conquistas` deixou de gravar `retroativa = false`.',
      '',
      '`retroativa = true` significa "a condição já estava cumprida antes de',
      'existir registro, então NÃO sabemos quando" — e a tela cala a data nesse',
      'caso. Se a RPC marcar true, nenhuma conquista mostra data nunca mais, e',
      'nada quebra: o registro continua sendo gravado.',
    ].join('\n')).toBe(true);

    const backfill = (SQL.match(
      /INSERT\s+INTO\s+(?:public\.)?conquistas_desbloqueadas[\s\S]*?FROM\s+(?:public\.)?profiles[\s\S]*?;/i
    ) || [''])[0];

    expect(/\btrue\b/.test(backfill), [
      'O backfill da migration deixou de marcar `retroativa = true`.',
      '',
      'Sem a marca, quem já tinha sete conquistas recebe A DATA DE HOJE nas',
      'sete — uma data que se apresenta como história e não é (§1.1). O card',
      'mostraria "conquistada em 10/10/2026" para um feito de julho.',
    ].join('\n')).toBe(true);
  });

  it('o cliente NÃO ganha caminho de escrita na tabela', () => {
    // Duas camadas, e o §1.3 pede as duas: sem `GRANT INSERT` a REST API não
    // alcança a tabela nem com policy, e sem policy a RLS nega mesmo com grant.
    const grants = SQL.match(/GRANT\s+[^;]*?\s+ON\s+(?:TABLE\s+)?(?:public\.)?conquistas_desbloqueadas[^;]*;/gi) || [];
    const escrita = grants.filter((g) => /INSERT|UPDATE|DELETE|ALL/i.test(g));

    expect(escrita, [
      'Alguém deu permissão de ESCRITA na tabela de conquistas ao cliente:',
      ...escrita.map((g) => `  - ${g.trim()}`),
      '',
      'Quem escreve ali é `registrar_conquistas()`, que mede no servidor. Com',
      'grant de escrita, forjar conquista volta a ser um `POST` na REST API —',
      'e, no dia em que moldura ou figurinha depender do desbloqueio, isso',
      'passa a ser forjar item de inventário.',
    ].join('\n')).toEqual([]);

    const policies = SQL.match(
      /CREATE\s+POLICY[^;]*?ON\s+(?:public\.)?conquistas_desbloqueadas[^;]*;/gi) || [];
    const deEscrita = policies.filter((p) => /FOR\s+(INSERT|UPDATE|DELETE|ALL)/i.test(p));

    expect(deEscrita, [
      'Apareceu policy de escrita na tabela de conquistas:',
      ...deEscrita.map((p) => `  - ${p.trim().slice(0, 120)}…`),
      '',
      'Ela é append-only por desenho, e escrita SÓ pela RPC. Policy de UPDATE',
      'aqui permitiria reescrever a própria data de desbloqueio.',
    ].join('\n')).toEqual([]);
  });

  it('a RLS está ligada na tabela', () => {
    expect(/ALTER\s+TABLE\s+(?:public\.)?conquistas_desbloqueadas\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
      .test(SQL), [
      'A tabela de conquistas ficou sem RLS.',
      '',
      'Com `GRANT SELECT TO authenticated` e sem RLS, qualquer pessoa logada lê',
      'o registro de TODO MUNDO. E toda tabela nova nasce aberta (SEC-052), então',
      'isto não é precaução teórica.',
    ].join('\n')).toBe(true);
  });
});

/**
 * ── A segunda deriva, que é mais antiga e ficou VISÍVEL agora ───────────────
 *
 * `perfil_completo` é a única conquista cuja medição não sai de um contador: o
 * JS conta campos preenchidos e o SQL faz o mesmo com `texto_visivel`. Enquanto
 * nada registrava desbloqueio, divergir só dava um selo errado na tela de quem
 * colou caractere invisível no próprio perfil. Com a tabela, a conquista passa
 * a aparecer concluída **e sem data, para sempre**.
 */
describe('o critério de "campo preenchido" é o mesmo nos dois lados', () => {
  /**
   * A classe de caracteres da `texto_visivel` do SQL, reconstruída e testada
   * por COMPORTAMENTO.
   *
   * Comparar o texto não serve, e isso já foi aprendido no
   * `xpSoPagaOQueAparece`: a migration pode guardar `\u200b` como escape ou
   * como o caractere já interpretado. Aqui os pedaços `E'...'` são
   * concatenados, os escapes viram caractere, e a pergunta passa a ser a certa
   * — *este caractere é removido?* — nos dois lados.
   */
  const classeDoSql = (() => {
    const fn = (SQL.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?texto_visivel[\s\S]*?\$fn\$[\s\S]*?\$fn\$/gi
    ) || [''] ).pop();
    const corpo = fn.match(/'\['([\s\S]*?)\|\|\s*'\]'/);
    if (!corpo) return null;
    return corpo[1]
      .split('||')
      .map((p) => (p.match(/E?'([\s\S]*)'/) || [])[1] || '')
      .join('')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  })();

  it('a classe do SQL foi reconstruída', () => {
    expect(classeDoSql, [
      'Não consegui reconstruir a classe de `texto_visivel` do SQL.',
      'Sem isto, a comparação abaixo não compara nada.',
    ].join('\n')).toBeTruthy();
    expect(classeDoSql.length, 'A classe veio vazia.').toBeGreaterThan(10);
  });

  // Um caractere de cada família que o SQL cobre, mais visíveis de controle.
  const CASOS = [
    ['\u200b', false, 'ZERO WIDTH SPACE — o mais fácil de colar'],
    [' ', false, 'NO-BREAK SPACE — o que o Word produz sozinho'],
    ['　', false, 'IDEOGRAPHIC SPACE — teclado CJK gera direto'],
    ['﻿', false, 'BOM — vem colado em texto copiado de arquivo'],
    ['⁠', false, 'WORD JOINER'],
    ['᠎', false, 'MONGOLIAN VOWEL SEPARATOR'],
    [' ',      false, 'espaço comum — o único que `trim` já pegava'],
    ['a',      true,  'letra'],
    ['9',      true,  'número'],
    ['ç',      true,  'acento'],
    ['🎮',     true,  'emoji'],
  ];

  it.each(CASOS)('%s: JS e SQL concordam que é visível=%s (%s)', (ch, visivel, oque) => {
    const soSql = ch.replace(new RegExp('[' + classeDoSql + ']', 'gu'), '');
    const vistoPeloSql = soSql.length > 0;
    const vistoPeloJs = textoVisivel(ch);

    expect({ sql: vistoPeloSql, js: vistoPeloJs }, [
      `JS e SQL discordam sobre ${oque}.`,
      '',
      'O SQL é a autoridade: é por `texto_visivel` que o bônus de perfil é pago',
      'e que `perfil_completo` é registrada. Quando o JS discorda, a tela mostra',
      'a conquista concluída e ela NUNCA recebe data — sem erro e sem log,',
      'porque a RPC simplesmente não encontra a condição cumprida.',
      '',
      'Os dois lados: `src/lib/textoVisivel.js` e a `texto_visivel` das',
      'migrations.',
    ].join('\n')).toEqual({ sql: visivel, js: visivel });
  });

  it('`perfil_completo` não voltou a medir com `trim()`', () => {
    const fonte = readFileSync('src/lib/conquistas.js', 'utf8')
      // Tira comentário: o cabeçalho deste arquivo EXPLICA o `trim()` que saiu,
      // e sem isto a trava acusaria a própria explicação — erro que já apareceu
      // três vezes neste projeto.
      .replace(/\/\*\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');

    expect(/\.trim\(\)\s*!==\s*''/.test(fonte), [
      '`lib/conquistas.js` voltou a medir campo preenchido com `.trim()`.',
      '',
      '`trim()` corta branco ASCII e mais nada: U+200B, U+00A0, U+3000, U+FEFF',
      'e U+2060 sobrevivem a ele. Isso reabre a divergência com o servidor, que',
      'usa `texto_visivel` desde a SEC-046 — e o sintoma é a conquista concluída',
      'na tela sem nunca receber data.',
      '',
      'Use `textoVisivel` de `lib/textoVisivel.js`.',
    ].join('\n')).toBe(false);

    expect(/textoVisivel\(/.test(fonte), [
      '`lib/conquistas.js` deixou de usar `textoVisivel`.',
      'Ele é o espelho de `texto_visivel` do banco — ver acima.',
    ].join('\n')).toBe(true);
  });
});
