import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LOG_RETENTION_DAYS, LOG_RETENTION_MAX_ROWS, ACTION_META } from '../logMeta';

/**
 * `[02/10]` RETENCAO HIBRIDA — tempo E quantidade.
 *
 * ── A garantia que o prazo NAO da ───────────────────────────────────────────
 *
 * `cleanup_old_data()` apagava por tempo desde 02/09. Isso promete que nada
 * vive mais de 365 dias e **nao** promete quantas linhas cabem nesses 365
 * dias — sao duas garantias diferentes, e so a segunda limita o tamanho.
 *
 * Medido em 02/10: 139 linhas/dia de media em `admin_logs`, com pico de 924
 * num unico dia. A media projeta ~50.700 no ano; o pico, se virasse rotina,
 * projeta ~337.000.
 *
 * ── As tres formas de isto apodrecer sem ninguem notar ─────────────────────
 *
 * **(1) O numero da UI deixar de bater com o do banco.** O painel diz quantos
 * dias o log dura, e agora ha um segundo limite. Se o teto do SQL mudar e a
 * constante nao, a tela promete uma janela que o banco nao cumpre — e isso nao
 * estoura em lugar nenhum, porque as duas metades continuam funcionando.
 *
 * **(2) O teto cortar em silencio.** Teto que apaga sem avisar transforma uma
 * noticia ("o site gera mais registro do que a janela comporta") em rotina
 * invisivel. A linha de `admin_logs` que avisa precisa existir, e a action
 * precisa estar registrada no mapa de icones — senao ela chega no painel com
 * o icone generico, que e como 14 actions ficaram invisiveis antes.
 *
 * **(3) O teto cortar pelo lado errado.** `ORDER BY created_at DESC OFFSET N`
 * guarda os N mais NOVOS; trocar para `ASC` guardaria os mais velhos e apagaria
 * a trilha de hoje. O sintoma seria "a trilha sumiu" — e o conserto, obvio
 * depois, custaria uma sessao para achar.
 *
 * ── O que ela NAO cobre, dito antes que alguem confie demais ───────────────
 *
 * Ela le a MIGRATION, nao o banco (mesma razao do SEC-042: credencial no CI e
 * troca que este projeto ja recusou tres vezes). O comportamento em si foi
 * provado em ROLLBACK contra o banco de verdade, e esta no cabecalho da
 * migration.
 *
 * ── Provada reinjetando o bug (§2) ────────────────────────────────────────
 *
 * Quatro reinjecoes, uma por checagem — ver o relatorio da sessao.
 */

const PASTA = 'supabase/migrations';

function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function ultimaQueCasa(padrao) {
  const nomes = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
  if (!nomes.length) throw new Error(`nenhuma migration lida em ${PASTA}/ — a pasta mudou de nome?`);
  const achadas = nomes
    .map((n) => ({ nome: n, sql: semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')) }))
    .filter((m) => padrao.test(m.sql));
  return achadas.length ? achadas[achadas.length - 1] : null;
}

describe('retenção híbrida — tempo E quantidade', () => {
  it('o TETO da UI bate com o teto do SQL', () => {
    const m = ultimaQueCasa(/FUNCTION\s+public\.cleanup_old_data\s*\(\)/i);
    expect(m, 'nenhuma migration define `cleanup_old_data()`.').not.toBeNull();
    expect(
      m.sql.includes(`aplicar_teto_de_linhas('admin_logs', ${LOG_RETENTION_MAX_ROWS})`),
      `o painel anuncia teto de ${LOG_RETENTION_MAX_ROWS} linhas e a faxina do banco usa outro.\n`
      + `    Procurei por aplicar_teto_de_linhas('admin_logs', ${LOG_RETENTION_MAX_ROWS}) em\n`
      + `    ${m.nome} e nao achei.\n`
      + '    Mudar um lado so faz a tela prometer uma janela que o banco nao\n'
      + '    cumpre — e nada estoura, porque as duas metades continuam de pe.\n'
      + '    Ajuste `LOG_RETENTION_MAX_ROWS` em src/lib/logMeta.js OU o numero\n'
      + '    da migration, os dois juntos.',
    ).toBe(true);
    // O prazo continua sendo a primeira dimensao, e ela tambem nao pode derivar.
    expect(
      m.sql.includes(`interval '${LOG_RETENTION_DAYS} days'`),
      `o prazo de ${LOG_RETENTION_DAYS} dias sumiu da faxina. Teto sem prazo deixa\n`
      + '    linha velha viver para sempre enquanto a tabela estiver abaixo do teto.',
    ).toBe(true);
  });

  it('o teto que corta GRITA, e o aviso tem ícone', () => {
    const m = ultimaQueCasa(/FUNCTION\s+public\.cleanup_old_data\s*\(\)/i);
    expect(
      /retencao_teto_atingido/.test(m.sql),
      'a faxina nao grava mais `retencao_teto_atingido` em `admin_logs`.\n'
      + '    Teto que corta em silencio transforma uma NOTICIA — o site gera mais\n'
      + '    registro do que a janela de 365 dias comporta — em rotina invisivel.\n'
      + '    Em operacao normal o teto apaga zero, entao esta linha so aparece\n'
      + '    quando alguem precisa saber (§1.5).',
    ).toBe(true);
    expect(
      ACTION_META.retencao_teto_atingido,
      '`retencao_teto_atingido` nao esta no mapa de icones de `logMeta.js`.\n'
      + '    Action gravada pelo BANCO nao aparece como string em src/, entao ela\n'
      + '    chega no painel com o icone generico e nada acusa. Foi assim que 14\n'
      + '    actions ficaram invisiveis ate a Fase 4 da auditoria.',
    ).toBeTruthy();
  });

  it('o teto guarda os mais NOVOS, nunca os mais velhos', () => {
    const m = ultimaQueCasa(/FUNCTION\s+public\.aplicar_teto_de_linhas/i);
    expect(m, 'nenhuma migration define `aplicar_teto_de_linhas`.').not.toBeNull();
    const ordenacoes = [...m.sql.matchAll(/ORDER BY\s+created_at\s+(ASC|DESC)/gi)]
      .map((x) => x[1].toUpperCase());
    expect(ordenacoes.length, 'nao achei nenhum ORDER BY created_at — a extracao quebrou.')
      .toBeGreaterThan(0);
    expect(
      ordenacoes.every((o) => o === 'DESC'),
      `o teto ordena por created_at ${ordenacoes.join('/')}.\n`
      + '    Com DESC + OFFSET N sobram os N mais NOVOS, que e o certo.\n'
      + '    Com ASC sobrariam os mais VELHOS e a faxina apagaria a trilha de\n'
      + '    hoje. O sintoma seria "a trilha sumiu", sem erro nenhum.',
    ).toBe(true);
  });

  it('o teto tem MARGEM — ele não corta a cada noite por um fio', () => {
    const m = ultimaQueCasa(/FUNCTION\s+public\.aplicar_teto_de_linhas/i);
    expect(
      /ceil\(\s*p_teto\s*\*\s*1\.25\s*\)/.test(m.sql),
      'o teto por tabela perdeu a margem de limpeza.\n'
      + '    Sem ela o corte roda TODA noite assim que a tabela encosta no teto —\n'
      + '    algumas linhas por vez, para sempre, e cada passada disparando o\n'
      + '    aviso `retencao_teto_atingido` ate ele virar ruido (§0.2, 4a regra).\n'
      + '    Foi restricao explicita do dono: "deixar passar do teto e so entao\n'
      + '    voltar a ele, em vez de limpar a cada pequeno excesso".\n'
      + '    A margem e DERIVADA (125%% do teto), nunca um segundo parametro —\n'
      + '    dois numeros independentes divergem.',
    ).toBe(true);

    const u = ultimaQueCasa(/FUNCTION\s+public\.aplicar_teto_por_usuario/i);
    expect(u, 'nenhuma migration define `aplicar_teto_por_usuario`.').not.toBeNull();
    expect(
      /ceil\(\s*p_teto\s*\*\s*1\.25\s*\)/.test(u.sql),
      'o teto POR USUARIO perdeu a margem.\n'
      + '    Mesma consequencia, e mais visivel: quem vive em 501 notificacoes\n'
      + '    perderia uma toda noite, para sempre.',
    ).toBe(true);
  });

  it('o nome da tabela é mapa FECHADO — o desconhecido estoura', () => {
    const m = ultimaQueCasa(/FUNCTION\s+public\.aplicar_teto_de_linhas/i);
    expect(
      /ELSE\s+RAISE EXCEPTION/i.test(m.sql.replace(/\s+/g, ' ')),
      'o `ELSE` de `aplicar_teto_de_linhas` nao levanta excecao.\n'
      + '    Tabela desconhecida nao pode cair num padrao: apontar a faxina para\n'
      + '    a tabela errada apaga dado certo sem erro nenhum (§4, fallback\n'
      + '    silencioso). `format(%I)` NAO resolve isto — ele impede injecao, nao\n'
      + '    impede alvo errado.',
    ).toBe(true);
  });
});
