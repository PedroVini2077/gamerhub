import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JANELA_DE_INFRACAO_DIAS } from '../../components/moderation/queueLabels';

/**
 * `[08/10]` A INVERSA DO PONTO DE INFRACAO — §5.
 *
 * ── O defeito que originou isto, e ele foi medido ──────────────────────────
 *
 * `handle_violation_escalation` somava `SUM(points) WHERE user_id = ...` sem
 * nenhum recorte, e `lift_suspension` zerava `suspended_until` sem tocar em
 * `violations`. Com 8 pontos guardados e limiar 8, a proxima infracao de
 * QUALQUER tamanho voltava a cruzar o limiar: o moderador perdoava e o sistema
 * desfazia o perdao sozinho. Nada no banco inteiro lia ou escrevia
 * `violations` alem do proprio gatilho (conferido em `pg_proc`) — nao existia
 * caminho nenhum, em tela ou em SQL, para perdoar um ponto.
 *
 * Como apareceu: `e2e/duasContas.mjs` oculta um post por execucao. Quatro
 * execucoes x 2 pontos = exatamente o limiar, a conta de teste foi suspensa, e
 * DOIS roteiros cairam de uma vez — `LinhaDePublicar` devolve `null` para quem
 * esta suspenso, e ir ao vivo e recusado.
 *
 * ── As quatro formas de isto apodrecer SEM NADA ESTOURAR ───────────────────
 *
 * **(1) A escalada voltar a somar infracao revogada.** O perdao continua
 * gravado, a tela continua dizendo "revogada", e o ponto volta a pesar. Nada
 * quebra: a pessoa so e re-suspensa por uma infracao que ja foi perdoada.
 *
 * **(2) O trigger sair de UMA das tres tabelas.** Post continuaria perdoando e
 * comentario nao. O sintoma seria "as vezes funciona", que e o mais caro de
 * diagnosticar — e foi exatamente a forma do bug que originou tudo isto.
 *
 * **(3) `lift_suspension` parar de perdoar.** Volta a ser decorativa: remove a
 * suspensao e deixa os pontos que a causaram de pe. A RPC continua respondendo
 * com sucesso, a notificacao continua chegando, e a re-suspensao vem na
 * infracao seguinte.
 *
 * **(4) A revogacao automatica parar de GRITAR.** Ponto que some sozinho, sem
 * nada gravado, e indistinguivel de bug (§1.5) — e quem restaurou o conteudo
 * nao pediu para perdoar ponto nenhum, entao a trilha e o unico lugar onde
 * isso aparece.
 *
 * ── O que ela NAO cobre ────────────────────────────────────────────────────
 *
 * Ela le a MIGRATION, nao o banco — mesma razao do SEC-042: credencial no CI e
 * troca que este projeto ja recusou tres vezes. O comportamento foi provado em
 * transacao com ROLLBACK contra o banco de verdade, e a primeira versao
 * REPROVOU ali (`admin_logs.admin_username` e NOT NULL e o trigger nao o
 * preenchia), que e o argumento do §5 em uma linha.
 */

const PASTA = 'supabase/migrations';
const TABELAS_DE_CONTEUDO = ['posts', 'comments', 'community_posts'];

function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Todas as migrations, em ordem, ja sem comentario. */
function migrations() {
  const nomes = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
  if (!nomes.length) throw new Error(`nenhuma migration lida em ${PASTA}/ — a pasta mudou de nome?`);
  return nomes.map((n) => ({ nome: n, sql: semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')) }));
}

/**
 * A ULTIMA migration que define o alvo. Olhar so a ultima importa: uma
 * migration posterior pode ter substituido a funcao e desfeito a garantia, e
 * procurar "em alguma migration" encontraria a versao velha e passaria.
 */
function ultimaQueCasa(padrao) {
  const achadas = migrations().filter((m) => padrao.test(m.sql));
  return achadas.length ? achadas[achadas.length - 1] : null;
}

/** O corpo da funcao nomeada, da ultima migration que a define. */
function corpoDaFuncao(nome) {
  // `CREATE ... FUNCTION`, e nao qualquer mencao: `EXECUTE FUNCTION public.x()`
  // num arquivo de gatilho tambem casa com "FUNCTION public.x(", e como
  // `ultimaQueCasa` devolve o ULTIMO arquivo, a trava passou a ler um arquivo
  // que so CHAMA a funcao — e acusou que o corpo dela tinha sumido. Achado ao
  // dividir a migration em cinco arquivos, em 08/10.
  const padrao = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${nome}\\s*\\(`, 'i');
  const m = ultimaQueCasa(padrao);
  if (!m) return null;
  // Do nome da funcao ate o fim do bloco `$...$ ... $...$` que a encerra.
  const i = m.sql.search(padrao);
  const resto = m.sql.slice(i);
  const tag = resto.match(/AS\s+(\$[A-Za-z_]*\$)/i);
  if (!tag) return { nome: m.nome, corpo: resto };
  const ini = resto.indexOf(tag[1]) + tag[1].length;
  const fim = resto.indexOf(tag[1], ini);
  return { nome: m.nome, corpo: fim === -1 ? resto.slice(ini) : resto.slice(ini, fim) };
}

describe('a infração tem inversa — o ponto pode ser perdoado', () => {
  it('a escalada só conta infração VIVA (`revogada_em IS NULL`)', () => {
    const f = corpoDaFuncao('handle_violation_escalation');
    expect(f, 'nenhuma migration define `handle_violation_escalation`.').not.toBeNull();

    // A soma e o coracao da escalada. Sem o filtro, perdoar vira decoracao:
    // o ponto continua pesando e a pessoa e re-suspensa por algo ja perdoado.
    const soma = f.corpo.match(/SUM\(points\)[\s\S]*?;/i);
    expect(soma, `nao achei o \`SUM(points)\` em \`${f.nome}\`.`).not.toBeNull();
    expect(
      /revogada_em\s+IS\s+NULL/i.test(soma[0]),
      `a escalada voltou a somar infração REVOGADA (${f.nome}).\n`
      + 'Sem `AND revogada_em IS NULL` na soma, o perdão é decorativo: o ponto\n'
      + 'continua pesando e a próxima infração re-suspende por algo que um\n'
      + 'moderador já desfez. Era exatamente este o bug de 03/10.',
    ).toBe(true);
  });

  it('a escalada tem JANELA de tempo, e ela vem do `site_config`', () => {
    const f = corpoDaFuncao('handle_violation_escalation');
    const soma = f.corpo.match(/SUM\(points\)[\s\S]*?;/i);
    expect(
      /created_at\s*>\s*now\(\)\s*-\s*make_interval/i.test(soma[0]),
      `a escalada voltou a somar a vida inteira da conta (${f.nome}).\n`
      + 'Sem a janela, servir a suspensão não devolve nada: os pontos ficam de pé\n'
      + 'para sempre, e sete advertências espalhadas por dois anos deixam a pessoa\n'
      + 'a uma infração do BAN permanente. Decisão dele em 08/10: 180 dias.',
    ).toBe(true);

    expect(
      /mod_violation_window_days/.test(f.corpo),
      'a janela virou número escondido no corpo da função.\n'
      + 'Ela mora em `site_config`, junto dos dois limiares que ela governa — a\n'
      + 'mesma tela que ajusta `mod_ban_threshold` tem de ajustar esta, sem\n'
      + 'migration e sem mim.',
    ).toBe(true);

    // Janela ausente ou absurda nao pode virar "o passado inteiro" nem "agora":
    // `make_interval(days => 0)` faria TODO ponto parar de contar, em silencio.
    expect(
      /v_janela\s*<\s*1\s*THEN\s*v_janela\s*:=/i.test(f.corpo),
      'a guarda de valor absurdo da janela sumiu.\n'
      + '`make_interval(days => 0)` é "agora": nenhuma infração contaria, a\n'
      + 'escalada desligaria inteira e nada estouraria (§1.5).',
    ).toBe(true);
  });

  it('o prazo da TELA bate com o do banco', () => {
    const m = ultimaQueCasa(/mod_violation_window_days/);
    expect(m, 'nenhuma migration define `mod_violation_window_days`.').not.toBeNull();
    expect(
      m.sql.includes(`'${JANELA_DE_INFRACAO_DIAS}'`),
      `o painel diz ${JANELA_DE_INFRACAO_DIAS} dias e a migration grava outro valor (${m.nome}).\n`
      + 'As duas metades continuam funcionando e só a promessa fica falsa: o\n'
      + 'moderador lê "Expirada" numa infração que o banco ainda soma, ou o\n'
      + 'contrário. É a mesma trava do `LOG_RETENTION_DAYS`.',
    ).toBe(true);
  });

  it('a inversa automática está nas TRÊS tabelas de conteúdo', () => {
    const todas = migrations();
    // Gatilho vale o do ARQUIVO MAIS NOVO que mexeu naquela tabela: um `DROP
    // TRIGGER` posterior desfaz o `CREATE` anterior, e olhar "em alguma
    // migration" acharia o CREATE morto e passaria.
    const faltando = TABELAS_DE_CONTEUDO.filter((tabela) => {
      let vivo = false;
      for (const m of todas) {
        const cria = new RegExp(
          `CREATE\\s+TRIGGER\\s+trg_revogar_infracao_restaurada[\\s\\S]{0,200}?ON\\s+public\\.${tabela}\\b`, 'i',
        );
        const dropa = new RegExp(
          `DROP\\s+TRIGGER[\\s\\S]{0,80}?trg_revogar_infracao_restaurada[\\s\\S]{0,80}?ON\\s+public\\.${tabela}\\b`, 'i',
        );
        // O CREATE vem depois do DROP no mesmo arquivo (padrão idempotente),
        // então quem decide é a última ocorrência.
        const iCria = m.sql.search(cria);
        const iDrop = m.sql.search(dropa);
        if (iCria !== -1 && iCria > iDrop) vivo = true;
        else if (iDrop !== -1 && iCria === -1) vivo = false;
      }
      return !vivo;
    });

    expect(
      faltando,
      `a revogação automática não alcança: ${faltando.join(', ')}.\n`
      + 'O sintoma seria "às vezes funciona": post perdoaria o ponto e comentário\n'
      + 'não, sem erro em lugar nenhum. Restaurar conteúdo oculto é a inversa de\n'
      + 'ocultá-lo em QUALQUER uma das três — é correção de classe (§5), não de caso.',
    ).toEqual([]);
  });

  it('o mapa de tabela do trigger é FECHADO, com erro no desconhecido', () => {
    const f = corpoDaFuncao('revogar_infracao_de_conteudo_restaurado');
    expect(f, 'nenhuma migration define `revogar_infracao_de_conteudo_restaurado`.').not.toBeNull();

    // `resolver_moderacao_de_conteudo_apagado` usa `ELSE 'chat'`. Aqui isso
    // seria errado: `live_chat` nao tem `hidden_at`, entao tabela fora do mapa
    // e erro de instalacao — nao um caso a adivinhar (§4, fallback silencioso).
    expect(
      /RAISE\s+EXCEPTION[\s\S]{0,160}?TG_TABLE_NAME/i.test(f.corpo),
      `o mapa de tabela de \`${f.nome}\` deixou de estourar no desconhecido.\n`
      + 'Sem o RAISE, instalar o gatilho numa tabela fora do mapa faz `v_tipo`\n'
      + 'virar NULL, o UPDATE não casar nada, e a revogação simplesmente não\n'
      + 'acontecer — em silêncio, que é o §4 na letra.',
    ).toBe(true);
  });

  it('a revogação automática GRITA na trilha', () => {
    const f = corpoDaFuncao('revogar_infracao_de_conteudo_restaurado');
    expect(
      /INSERT\s+INTO\s+admin_logs[\s\S]{0,400}?'violation_revoked'/i.test(f.corpo),
      `\`${f.nome}\` deixou de gravar \`violation_revoked\` em \`admin_logs\`.\n`
      + 'Quem restaurou o conteúdo não pediu para perdoar ponto nenhum — a trilha\n'
      + 'é o único lugar onde isso aparece. Ponto que some sem rastro é\n'
      + 'indistinguível de bug (§1.5).',
    ).toBe(true);

    // `admin_logs.admin_username` e NOT NULL. A 1a versao desta migration nao o
    // preenchia e o teste em ROLLBACK reprovou com "null value in column
    // admin_username" — o trigger estourava e restaurar conteudo parava de
    // funcionar. Esta checagem existe para isso nao voltar.
    expect(
      /admin_username/i.test(f.corpo),
      `\`${f.nome}\` escreve em \`admin_logs\` sem \`admin_username\`, que é NOT NULL.\n`
      + 'O trigger estoura, e o sintoma NÃO é "o log não apareceu": é RESTAURAR\n'
      + 'CONTEÚDO OCULTO PARAR DE FUNCIONAR, porque o trigger derruba o UPDATE.\n'
      + 'Foi assim que a 1ª versão reprovou no ROLLBACK de 08/10.',
    ).toBe(true);
  });

  it('`lift_suspension` perdoa os pontos que causaram a suspensão', () => {
    const f = corpoDaFuncao('lift_suspension');
    expect(f, 'nenhuma migration define `lift_suspension`.').not.toBeNull();

    const revoga = f.corpo.match(/UPDATE\s+violations[\s\S]{0,500}?;/i);
    expect(
      revoga,
      `\`lift_suspension\` (${f.nome}) voltou a NÃO tocar em \`violations\`.\n`
      + 'Ela vira decorativa: remove a suspensão e deixa de pé os pontos que a\n'
      + 'causaram, então a próxima infração de qualquer tamanho re-suspende na\n'
      + 'hora. A RPC responde com sucesso e a notificação chega — por isso isto\n'
      + 'passou despercebido até 03/10.',
    ).not.toBeNull();

    expect(
      /revogada_em\s*=\s*now\(\)/i.test(revoga[0]) && /revogada_por\s*=\s*auth\.uid\(\)/i.test(revoga[0]),
      'o perdão de `lift_suspension` deixou de registrar QUEM perdoou.\n'
      + 'Revogar não é apagar: a linha fica, e sem `revogada_por` ninguém\n'
      + 'consegue explicar seis meses depois por que aquele ponto não conta.',
    ).toBe(true);
  });

  it('revogação sem motivo é impossível, e a trava é do BANCO', () => {
    const m = ultimaQueCasa(/violations_revogacao_tem_motivo/i);
    expect(m, 'o CHECK `violations_revogacao_tem_motivo` sumiu das migrations.').not.toBeNull();
    expect(
      /CHECK\s*\(\s*revogada_em\s+IS\s+NULL\s+OR\s+btrim/i.test(m.sql),
      `o CHECK de motivo (${m.nome}) deixou de exigir texto não-vazio.\n`
      + 'É a trava mais forte da tabela do §2 (constraint no banco): com ela,\n`'
      + 'revogação sem explicação passa a ser IMPOSSÍVEL, não apenas desencorajada.',
    ).toBe(true);
  });
});
