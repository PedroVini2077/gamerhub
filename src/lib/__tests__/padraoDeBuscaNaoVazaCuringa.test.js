import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[02/10]` SEC-055 — o CORINGA do `ILIKE` entregando a base inteira.
 *
 * ── O achado, e ele nasceu de uma regra nova ──────────────────────────────
 *
 * A Fase 3 do radar precisou escapar `%` e `_` porque os termos vinham do
 * modelo. Ao escrever isso como regra em `docs/regras/BANCO.md`, a varredura
 * da CLASSE (§1.3 — *"onde mais esse padrão existe?"*) achou `buscar_pessoas`:
 *
 *     AND pr.username ILIKE '%' || v_termo || '%'      -- v_termo CRU
 *
 * `SECURITY DEFINER`, e `authenticated` executa. Medido em produção,
 * assumindo o papel de um usuário comum:
 *
 *     buscar_pessoas('%%', 50)  ->  6 perfis, a BASE INTEIRA, com os CARGOS
 *
 * ── Por que isto é grave sem ser injeção ──────────────────────────────────
 *
 * **Não é injeção de SQL.** O valor é parâmetro: o Postgres nunca o executa
 * como código, e `quote_literal` não resolveria nada. O estrago é o coringa
 * do operador de padrão — e ele tem duas caras:
 *
 *   1. **enumeração** (§1.3 a nomeia): `%%` devolve o cadastro completo, e a
 *      coluna `role` junto é o mapa de quem atacar;
 *   2. **número absurdo com cara de medição**: no radar, um `%` solto contaria
 *      a tabela inteira e a tela diria "12x o normal". Nada estoura, nada loga.
 *
 * ── A trava é de CLASSE, e tem mapa de exceções com motivo ────────────────
 *
 * Corrigir só `buscar_pessoas` deixaria a próxima RPC de busca nascer com o
 * mesmo buraco — foi assim que `owner` sumiu de 14 policies três vezes. Esta
 * varredura lê as migrations e exige `escapar_curinga` em todo `ILIKE`/`LIKE`
 * cujo operando é **variável**, não literal.
 *
 * As migrations são histórico e **não se reescrevem** (23 travas leem o texto
 * delas), então as ocorrências antigas entram num mapa que exige motivo
 * escrito — mesmo desenho de `autorizacaoAntesDeExistencia.test.js`.
 */

const DIR = 'supabase/migrations';

/**
 * Ocorrências ANTERIORES a esta trava, cada uma com o motivo de ficar.
 *
 * Entrar aqui é decisão deliberada e pede frase. Sem o motivo escrito, o mapa
 * vira um lugar onde se esconde o que não se quis consertar.
 */
const PERDOADAS = {
  '20260924210500_busca_rpcs_de_posts_e_pessoas.sql':
    'a versao ORIGINAL de `buscar_pessoas`, com o defeito. Migration e historico '
    + 'e nao se reescreve; a correcao esta em '
    + '`20261002*_escapar_curinga_fecha_a_enumeracao_pela_busca_de_pessoas.sql`.',
  '20261001220000_news_aceleracao_de_termos_para_a_fase_3_do_radar.sql':
    'o escape inline do radar, que cobria `%` e `_` mas NAO a barra — um termo '
    + 'terminado em `\\` fazia o Postgres levantar erro. Substituido pela funcao '
    + 'compartilhada na migration seguinte.',
};

/**
 * O operando do `LIKE` é um literal fechado, ou tem variável no meio?
 *
 * Literal puro (`ILIKE '%delete%' THEN`) é seguro: o padrão é nosso, escrito
 * à mão. O que importa é o operando CONCATENADO — `'%' || x || '%'` —, porque
 * aí o coringa pode vir de fora.
 */
const OPERANDO_NAO_LITERAL =
  /\bI?LIKE\s+(?!'(?:[^']|'')*'\s*(?:$|[);,]|\s+(?:ESCAPE|THEN|AND|OR|DESC|ASC)\b))/g;

/**
 * Tira o que NÃO é código antes de procurar: comentário de `--`, e
 * **identificador entre aspas duplas**.
 *
 * O segundo não é zelo — foi um falso positivo real desta trava no 1º run:
 * a policy `"User insere proprio like de comentario"` tem a palavra "like" no
 * NOME, e a varredura a acusou. Trava que grita no lugar errado vira ruído, e
 * ruído ensina a ignorar o canal (§0.2, 4ª regra).
 */
function semRuido(sql) {
  return sql
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/**
 * Corta o arquivo em BLOCOS de função — e é por isso que a checagem não é por
 * linha.
 *
 * `buscar_pessoas` escapa numa linha (`v_padrao := escapar_curinga(...)`) e
 * usa na seguinte. Uma varredura linha a linha acusaria a própria correção —
 * e acusou, no 1º run desta trava. A pergunta certa é *"este CORPO de função
 * escapa o que ele compara?"*.
 */
function blocosDeFuncao(sql) {
  return semRuido(sql).split(/(?=CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION)/i);
}

describe('nenhum padrao de busca recebe o termo cru', () => {
  const arquivos = readdirSync(DIR).filter((n) => n.endsWith('.sql'));

  it('a varredura leu migration de verdade', () => {
    // Sem este controle, renomear a pasta deixa tudo abaixo verde para sempre.
    expect(arquivos.length, `${DIR} nao tem migration nenhuma — a pasta mudou de `
      + 'lugar? Checagem que nao le nada passa sempre.').toBeGreaterThan(50);
  });

  it('todo ILIKE/LIKE com variavel passa por `escapar_curinga`', () => {
    const infratores = [];
    for (const nome of arquivos) {
      if (nome in PERDOADAS) continue;
      for (const bloco of blocosDeFuncao(readFileSync(join(DIR, nome), 'utf8'))) {
        OPERANDO_NAO_LITERAL.lastIndex = 0;
        if (!OPERANDO_NAO_LITERAL.test(bloco)) continue;
        if (/escapar_curinga/.test(bloco)) continue;
        const linha = bloco.split('\n').find((l) => /\bI?LIKE\s/.test(l)) ?? '';
        infratores.push(`${nome}  ${linha.trim().slice(0, 90)}`);
      }
    }
    expect(infratores, 'estes `ILIKE`/`LIKE` comparam contra um valor que o corpo '
      + 'da funcao nao escapou. NAO e injecao (o valor e parametro) — e o CORINGA: '
      + 'um `%` solto casa com a tabela inteira. Em `buscar_pessoas` isso '
      + 'entregava os 6 perfis COM OS CARGOS a qualquer pessoa logada (SEC-055). '
      + 'Envolva o termo em `public.escapar_curinga(...)`, ou — se o padrao for '
      + 'escrito a mao de verdade — acrescente em PERDOADAS COM O MOTIVO.')
      .toEqual([]);
  });

  it('cada perdao tem motivo escrito, e o arquivo perdoado existe', () => {
    for (const [nome, motivo] of Object.entries(PERDOADAS)) {
      expect(arquivos, `PERDOADAS cita ${nome}, que nao existe mais. Perdao que `
        + 'sobrevive ao arquivo e um buraco que ninguem ve.').toContain(nome);
      expect(motivo.length, `o perdao de ${nome} precisa de motivo ESCRITO`)
        .toBeGreaterThan(40);
    }
  });

  it('a funcao de escape existe, e escapa a BARRA primeiro', () => {
    const sql = arquivos.map((n) => readFileSync(join(DIR, n), 'utf8')).join('\n');
    expect(sql, 'ninguem cria `escapar_curinga` — renomear a funcao deixaria a '
      + 'checagem acima procurando por um nome que nao existe mais, e ela '
      + 'passaria verde sobre codigo vulneravel')
      .toMatch(/CREATE OR REPLACE FUNCTION public\.escapar_curinga/);
    // A ordem nao e detalhe: escapar `%` antes da barra faria o proprio escape
    // introduzir barras que os replaces seguintes escapariam de novo.
    expect(sql, 'o escape precisa tratar a BARRA antes de `%` e `_` — senao um '
      + 'termo terminado em `\\` deixa o padrao terminando em caractere de '
      + 'escape, e o Postgres levanta erro na cara de quem buscou')
      .toMatch(/replace\(replace\(replace\(\$1, '\\', '\\\\'\), '%'/);
  });
});
