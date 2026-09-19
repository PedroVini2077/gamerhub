import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[19/09]` LIVE-052 — a moderação alcança a live depois que o cron apagou o post.
 *
 * ── O que foi medido ──────────────────────────────────────────────────────
 *
 *   sessões em `lives_realizadas` ................. 10
 *   com o post JÁ APAGADO pelo cron ............... 10
 *   VÁLIDAS e fora do alcance da moderação .........  8
 *
 * A invalidação era trigger em `posts`, e o cron apaga o post 15 min depois da
 * live. Sem post não havia `UPDATE` para disparar — o XP virava permanente.
 *
 * ── O acoplamento que esta trava existe para proteger ─────────────────────
 *
 * As três formas de invalidar convivem na MESMA coluna (`invalidada_motivo`),
 * e o texto dela **é** o mecanismo:
 *
 *   'ocultada pela moderacao'      automática — o trigger de restaurar limpa
 *   'apagada pela equipe'          automática — permanece ao restaurar
 *   'invalidada pela equipe: …'    MANUAL — só a RPC inversa desfaz
 *
 * Se o prefixo manual virar igual ao automático, restaurar um post passa a
 * desfazer, por baixo, uma decisão que uma pessoa tomou. Se a `revalidar`
 * parar de recusar as automáticas, passam a existir duas portas para o mesmo
 * estado — e elas divergem (§4). Nenhuma das duas quebra nada visível: é §1.5.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . prefixo manual = o texto automático  -> falhou apontando a colisão
 *   . `revalidar` sem a recusa da automática -> falhou apontando as 2 portas
 *   . `invalidar` sem faixa no motivo        -> falhou apontando a REST API
 *   . RPC sem `can_moderate_content`         -> falhou apontando a hierarquia
 *   . RPC sem aviso ao autor                 -> falhou apontando o §1.5
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 10 vezes. */
const semComentariosSQL = (sql) =>
  sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

const SQL = (() => {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8'))).join('\n');
})();

function funcao(nome) {
  const achados = SQL.match(new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${nome}\\s*\\([\\s\\S]*?\\$fn\\$[\\s\\S]*?\\$fn\\$`,
    'gi'));
  if (!achados) {
    throw new Error(
      `A função \`${nome}\` sumiu das migrations, ou a marcação mudou.\n`
      + '  Sem ela esta trava não olha nada e fica verde para sempre.');
  }
  return achados[achados.length - 1];
}

/** O texto exato que a invalidação AUTOMÁTICA grava — a fonte do acoplamento. */
const MOTIVOS_AUTOMATICOS = ['ocultada pela moderacao', 'apagada pela equipe'];
const PREFIXO_MANUAL = 'invalidada pela equipe: ';

describe('LIVE-052 — a moderação alcança a live depois do cron', () => {
  const invalidar = funcao('invalidar_live_realizada');
  const revalidar = funcao('revalidar_live_realizada');

  it('o motivo MANUAL não colide com nenhum automático', () => {
    expect(invalidar, [
      `A \`invalidar_live_realizada\` não grava mais o prefixo "${PREFIXO_MANUAL}".`,
      '',
      'Esse prefixo é o que separa o ato de uma PESSOA do ato automático. O',
      'trigger `invalidar_lives_do_post_moderado` limpa, ao restaurar o post,',
      `só as linhas com motivo = "${MOTIVOS_AUTOMATICOS[0]}".`,
      '',
      'Sem o prefixo, restaurar um post passa a desfazer por baixo uma decisão',
      'que a equipe tomou à mão — e nada avisa, porque restaurar é uma ação',
      'legítima que continua funcionando.',
    ].join('\n')).toContain(PREFIXO_MANUAL);

    for (const automatico of MOTIVOS_AUTOMATICOS) {
      expect(PREFIXO_MANUAL.trim().startsWith(automatico), [
        `O prefixo manual passou a começar com "${automatico}".`,
        '',
        'Os dois são comparados por texto em lugares diferentes do banco.',
        'Colisão aqui faz a invalidação manual ser tratada como automática.',
      ].join('\n')).toBe(false);
    }
  });

  it('a inversa RECUSA desfazer invalidação automática', () => {
    expect(revalidar, [
      'A `revalidar_live_realizada` parou de recusar motivo automático.',
      '',
      'A volta de uma invalidação automática é RESTAURAR O POST — existe um',
      'trigger que já sabe quando devolver. Deixar a RPC desfazer também cria',
      'duas portas para o mesmo estado, e duas portas divergem (§4): a equipe',
      'devolveria o XP por aqui e o trigger tornaria a tirar no próximo toque',
      'no post, sem ninguém entender por quê.',
    ].join('\n')).toMatch(/NOT\s+LIKE\s+'invalidada pela equipe: %'/i);
  });

  it('o motivo tem FAIXA, não só tipo', () => {
    expect(invalidar, [
      'A `invalidar_live_realizada` parou de validar o tamanho do motivo.',
      '',
      '`text` aceita string vazia e aceita 10 MB. O motivo vai para a trilha de',
      'auditoria E para a notificação do autor — motivo vazio deixa a punição',
      'sem explicação, que é o mesmo que não avisar.',
      '',
      'E validar na tela não vale: o site usa a `anon key`, e qualquer um chama',
      '`/rest/v1/rpc/invalidar_live_realizada` direto com o corpo que quiser.',
      '',
      'Atenção ao NULL: em SQL `NULL < 3` é NULL e o `IF` não dispara — por',
      'isso a checagem de `IS NULL` é explícita.',
    ].join('\n')).toMatch(/p_motivo\s+IS\s+NULL\s+OR\s+length/i);
  });

  it('as duas RPCs de escrita respeitam a hierarquia, por FUNÇÃO', () => {
    for (const [nome, corpo] of [['invalidar_live_realizada', invalidar],
                                 ['revalidar_live_realizada', revalidar]]) {
      expect(corpo, [
        `A \`${nome}\` parou de usar \`can_moderate_content\`.`,
        '',
        'Hierarquia nunca se escreve à mão neste projeto: lista literal de',
        'papéis já causou TRÊS falhas, sempre pelo mesmo motivo — alguém',
        'esquece `owner` na lista e o fundador perde o próprio poder.',
        '',
        'Sem ela, um `admin` passa a invalidar o XP da live de outro `admin`.',
      ].join('\n')).toMatch(/can_moderate_content\s*\(/i);
    }
  });

  it('o autor é avisado nas DUAS direções', () => {
    for (const [nome, corpo] of [['invalidar_live_realizada', invalidar],
                                 ['revalidar_live_realizada', revalidar]]) {
      expect(corpo, [
        `A \`${nome}\` parou de notificar o autor.`,
        '',
        'O BANCO.md exige que o alvo da ação saiba: do lado dele, XP que cai',
        'sozinho é indistinguível de bug — e ele abriria um chamado sobre algo',
        'que a equipe fez de propósito.',
        '',
        'Vale para a volta também: devolver o XP em silêncio deixa a pessoa',
        'achando que a punição continua de pé.',
      ].join('\n')).toMatch(/INSERT\s+INTO\s+notifications/i);
    }
  });

  it('a tela não decide permissão — ela só evita o clique perdido', () => {
    const componente = readFileSync('src/components/admin/XpDasLives.jsx', 'utf8');
    expect(componente, [
      'O `XpDasLives` parou de olhar `posso_moderar`.',
      '',
      'Ele não é a segurança — o banco confere de novo dentro de cada RPC. Ele',
      'existe para não oferecer um botão que vai falhar, que é UX, não defesa.',
    ].join('\n')).toContain('posso_moderar');

    expect(funcao('listar_lives_realizadas'), [
      'A `listar_lives_realizadas` parou de devolver `can_moderate_content`.',
      '',
      'A tela passa a não saber quais linhas pode moderar, e ou esconde tudo,',
      'ou oferece botão que sempre falha.',
    ].join('\n')).toMatch(/can_moderate_content\s*\(\s*lr\.user_id\s*\)/i);
  });
});
