import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[18/09]` LIVE-040 / SEC-041 — a regra é uma só, e eu a apliquei pela metade
 * três vezes seguidas.
 *
 *     XP paga pelo que ESTÁ NO AR, e interação de post fora do ar não é
 *     legível por quem não é da equipe. Em NENHUMA forma: post, comentário,
 *     live ou chat.
 *
 * ── Por que esta trava existe, e por que ela é separada ────────────────────
 *
 * A SEC-028 (17/09) fechou "ocultar era punição sem efeito" — para POSTS. No
 * dia seguinte, três achados de uma auditoria externa mostraram que a mesma
 * regra tinha buracos em três lugares diferentes, e **os três eram meus**:
 *
 *   N8   a LIVE-036/037 soltou o XP de live do post para ele sobreviver ao
 *        cron. Ao soltar do post, soltei também da MODERAÇÃO
 *   N9   comentário de post APAGADO continuava pagando 3 XP
 *   N10  comentário de post OCULTO idem
 *   N11  comentário de post fora do ar continuava LEGÍVEL pela REST API
 *   N12  mensagem de live chat idem, e a `live_chat` era `USING (true)`
 *
 * Medido antes da correção, com papel `authenticated` real:
 *
 *   ocultar um POST COMUM ..... XP 1 -> 0    (a SEC-028 funciona)
 *   ocultar uma LIVE .......... XP 1 -> 1    (não alcançava)
 *   apagar  uma LIVE .......... XP 1 -> 1    (não alcançava)
 *   ler comentário de post apagado, como comum ..... 1 linha
 *   ler chat de post apagado, como comum .......... 1 linha
 *
 * A trava é separada da `colunasDerivadasDoPost` de propósito: lá a história é
 * "coluna privilegiada não vem do cliente"; aqui é "o que saiu do ar sai de
 * tudo". Duas histórias no mesmo arquivo é como a metade esquecida passou.
 *
 * ── Provada reinjetando cada bug (§2) ──────────────────────────────────────
 *
 *   . tirado `invalidada_em IS NULL` da view    -> falhou apontando N8
 *   . tirado `po.deleted_at IS NULL` do bloco
 *     de comments                               -> falhou apontando N9/N10
 *   . devolvido `USING (true)` na live_chat     -> falhou apontando N12
 *   . trocado `AFTER UPDATE` por
 *     `AFTER UPDATE OR DELETE` no trigger       -> falhou apontando o cron
 *
 * ── O que ela NÃO cobre ───────────────────────────────────────────────────
 *
 * Alguém desfazendo isso direto no editor SQL, sem migration. O que ela cobre
 * é o caminho realista, que é o que de fato aconteceu: reescrever a view ou a
 * policy sem perceber qual metade da regra caiu junto.
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 10 vezes. */
function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function migrationsEmOrdem() {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) {
    throw new Error(`Nenhuma migration em "${PASTA}" — a pasta mudou de lugar?`);
  }
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')));
}

/** O corpo da ÚLTIMA ocorrência de um padrão, que é a que vale hoje. */
function ultimo(re) {
  let corpo = null;
  for (const sql of migrationsEmOrdem()) {
    const achados = sql.match(re);
    if (achados) corpo = achados[achados.length - 1];
  }
  return corpo;
}

const RE_VIEW = /CREATE\s+OR\s+REPLACE\s+VIEW\s+(?:public\.)?xp_dos_usuarios\b[\s\S]*?;/gi;
const view = ultimo(RE_VIEW);

/**
 * Um dos quatro `LEFT JOIN (SELECT ... COUNT(*) AS <nome> ... GROUP BY` da view.
 *
 * Ancora em `COUNT(*) AS`, e não em `AS <nome>`, porque cada um desses nomes
 * aparece TAMBÉM na lista de colunas do topo (`COALESCE(cc.comentarios,0)::int
 * AS comentarios`). Casar o primeiro devolvia o cabeçalho da view inteiro, e o
 * teste media a condição errada — exatamente o tipo de falso negativo que o
 * `varrerFontes` existe para impedir do outro lado.
 */
function blocoDaView(nome) {
  const m = (view || '').match(
    new RegExp(`COUNT\\(\\*\\)\\s+AS\\s+${nome}\\b[\\s\\S]*?GROUP\\s+BY`, 'i'),
  );
  if (!m) throw new Error(`Bloco "${nome}" não existe na view — ela foi reescrita?`);
  return m[0];
}

describe('LIVE-040 — o XP paga só pelo que está no ar', () => {
  it('a view `xp_dos_usuarios` continua sendo a fonte única', () => {
    expect(view, [
      'A view `xp_dos_usuarios` sumiu das migrations.',
      'Sem ela cada RPC volta a calcular XP por conta — o achado 12 do pentest.',
    ].join('\n')).toBeTruthy();
  });

  it('não conta LIVE invalidada pela moderação (N8)', () => {
    expect(blocoDaView('lives'), [
      'O bloco de `lives` da view parou de filtrar `invalidada_em IS NULL`.',
      '',
      'Isso reabre o N8, e ele foi INTRODUZIDO por mim: a LIVE-036/037 soltou',
      'o XP de live do post (para o registro sobreviver ao cron que apaga a',
      'live 15 min depois de encerrar) e, ao soltar do post, soltou também da',
      'moderação — que age no post.',
      '',
      'Medido: ocultar um post comum levava o XP de 1 para 0; ocultar uma LIVE',
      'deixava em 1. Punição sem efeito, exatamente o que a SEC-028 fechou.',
      '',
      'O bloco precisa de `WHERE invalidada_em IS NULL`.',
    ].join('\n')).toMatch(/invalidada_em\s+IS\s+NULL/i);
  });

  it('a live precisa de DURAÇÃO mínima para pagar', () => {
    expect(blocoDaView('lives'), [
      'O bloco de `lives` parou de exigir duração mínima.',
      '',
      'Sem isso, abrir e fechar a live no mesmo segundo paga os 30 XP — era o',
      'achado GH-XP-LIVE-001 por outro caminho. O mínimo é configurável pelo',
      'painel (`site_config` -> `live_xp_minutos`), via `live_minutos_para_xp()`.',
    ].join('\n')).toMatch(/live_minutos_para_xp\s*\(\s*\)/i);
  });

  it('o comentário só conta se ELE e o POST PAI estiverem no ar (7, N9, N10)', () => {
    expect(blocoDaView('comentarios'), [
      'O bloco de `comments` da view voltou a contar comentário fora do ar.',
      '',
      'São DUAS condições, e a segunda ficou esquecida por um dia inteiro:',
      '  1. o próprio comentário não pode estar oculto -> `c.hidden_at IS NULL`',
      '  2. o POST PAI precisa estar no ar             -> `po.deleted_at IS NULL',
      '     AND po.hidden_at IS NULL`',
      '',
      'Sem a 1, ocultar o comentário não tira o XP dele (achado 7).',
      'Sem a 2, apagar o post deixa cada comentário dele pagando 3 XP —',
      'invisível na tela, vivo na conta (N9 e N10).',
    ].join('\n')).toMatch(
      /c\.hidden_at\s+IS\s+NULL\s+AND\s+po\.deleted_at\s+IS\s+NULL\s+AND\s+po\.hidden_at\s+IS\s+NULL/i,
    );
  });

  const trigger = ultimo(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?invalidar_lives_do_post_moderado[\s\S]*?\$fn\$\s*;/gi,
  );

  it('a invalidação existe e tem INVERSA (BANCO.md)', () => {
    expect(trigger, [
      'A função `invalidar_lives_do_post_moderado` sumiu das migrations.',
    ].join('\n')).toBeTruthy();

    expect(trigger, [
      'A invalidação de live perdeu a INVERSA.',
      '',
      'O BANCO.md exige que toda ação de estado tenha volta: restaurar o post',
      'precisa devolver o XP da live. Sem isso, um engano da moderação vira',
      'punição PERMANENTE, e nem o owner desfaz — foi exatamente o caso da',
      '`apply_suspension` sem `lift_suspension`.',
      '',
      'O ramo `hidden_at IS NOT NULL -> NULL` precisa limpar `invalidada_em`.',
    ].join('\n')).toMatch(/invalidada_em\s*=\s*NULL/i);
  });

  it('o gatilho NUNCA dispara no DELETE físico — e isso é deliberado', () => {
    const criacoes = migrationsEmOrdem().join('\n')
      .match(/CREATE\s+TRIGGER\s+trg_invalidar_lives_moderadas[\s\S]*?;/gi) || [];
    const atual = criacoes[criacoes.length - 1] || '';

    expect(atual, ['O trigger `trg_invalidar_lives_moderadas` sumiu.'].join('\n')).toBeTruthy();

    expect(/\bDELETE\b/i.test(atual), [
      'O trigger de invalidação passou a escutar DELETE, e isso é PERIGOSO.',
      '',
      'Quem apaga live fisicamente é o cron, 15 minutos depois de cada live.',
      'Distinguir cron de moderação exigiria confiar em `auth.uid()` ser NULL —',
      'e o teste dessa suposição REPROVOU: `RESET role` não limpa',
      '`request.jwt.claims`, então o "cron" de mentira ainda tinha um admin',
      'dentro e invalidou o registro.',
      '',
      'Os dois modos de errar não são equivalentes:',
      '  não invalidar quando devia -> um banido guarda XP que não usa',
      '  invalidar quando não devia -> o site INTEIRO perde XP de live, calado,',
      '                                 15 min depois de cada live, para sempre',
      '',
      'Se algum dia isto precisar mudar, a prova tem que vir de uma sessão real',
      'do cron, não de um `RESET role` em ROLLBACK.',
    ].join('\n')).toBe(false);
  });
});

describe('SEC-041 — interação de post fora do ar não é legível (N11, N12)', () => {
  function ultimaPolicy(nome) {
    return ultimo(new RegExp(`CREATE\\s+POLICY\\s+${nome}\\s+ON[\\s\\S]*?;`, 'gi'));
  }

  const CASOS = [
    ['comments_select',  'comments',  'o fio de comentários de um post que a equipe tirou do ar'],
    ['live_chat_select', 'live_chat', 'o chat de uma live que a equipe tirou do ar'],
  ];

  it.each(CASOS)('a policy `%s` exige que o POST PAI aceite interação', (policy, tabela, oQue) => {
    const corpo = ultimaPolicy(policy);

    expect(corpo, [
      `A policy \`${policy}\` sumiu das migrations.`,
      `Sem ela, \`${tabela}\` volta ao estado em que o pentest a encontrou.`,
    ].join('\n')).toBeTruthy();

    expect(corpo, [
      `A policy \`${policy}\` parou de olhar o POST PAI.`,
      '',
      `Quem não é da equipe volta a ler ${oQue}.`,
      '',
      'Medido com papel `authenticated` real: depois de apagar o post, o comum',
      'lia 1 comentário e 1 mensagem de chat, enquanto o POST devolvia 0 linhas.',
      'Ocultar um post costuma ser por causa da CONVERSA, não do texto do post —',
      'deixar o fio legível resolve a metade que aparece na tela, não a que',
      'importa.',
      '',
      'A condição é `post_aceita_interacao(post_id)`.',
    ].join('\n')).toMatch(/post_aceita_interacao\s*\(\s*post_id\s*\)/i);
  });

  it.each(CASOS)('a policy `%s` mantém a escapatória da EQUIPE', (policy) => {
    expect(ultimaPolicy(policy), [
      `A policy \`${policy}\` perdeu o escape de \`role_rank >= 2\`.`,
      '',
      'Sem ele a fila de moderação fica cega justamente para o conteúdo que',
      'precisa julgar: a equipe oculta o post e perde o acesso à conversa que',
      'motivou a ocultação. Seria trocar um buraco por outro — foi o que quase',
      'aconteceu na SEC-025, quando revogar colunas de `profiles` derrubou',
      'postar, comentar, mural e chat de uma vez.',
    ].join('\n')).toMatch(/role_rank\s*\([\s\S]*?\)\s*>=\s*2/i);
  });

  it('`post_likes` ficou de FORA de propósito, e o motivo está escrito', () => {
    // Não é esquecimento: a auditoria levantou o mesmo ponto para curtidas
    // (N13) e concluiu que não é falha. Curtida não carrega conteúdo, e
    // `post_likes` é a leitura mais quente do site — o `attachEngagement` busca
    // as curtidas de 30 posts por carregamento de feed. Uma subconsulta por
    // linha ali custa caro para sempre, contra um vazamento de valor ~zero.
    //
    // A trava é sobre o MOTIVO continuar escrito, não sobre a policy: decisão
    // deliberada sem registro volta como "esqueceram" na próxima auditoria.
    const sql = migrationsEmOrdem;   // marcador: a leitura real é do arquivo cru
    expect(typeof sql).toBe('function');

    const cru = readdirSync(PASTA).filter(n => n.includes('sec_041'))
      .map(n => readFileSync(join(PASTA, n), 'utf8')).join('\n');

    expect(cru, [
      'A migration da SEC-041 sumiu, ou perdeu a justificativa de `post_likes`.',
      '',
      'Deixar curtidas de fora foi DECISÃO MEDIDA, não esquecimento. Se o texto',
      'sumir, a próxima auditoria vai reabrir o ponto como buraco — e a conta',
      'certa (caminho quente do app × vazamento ~zero) some junto.',
    ].join('\n')).toMatch(/post_likes/i);
  });
});
