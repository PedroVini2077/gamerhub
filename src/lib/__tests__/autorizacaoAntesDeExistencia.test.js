import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[18/09]` SEC-032/033/034 — as travas da segunda auditoria externa.
 *
 * ── A trava mais importante deste arquivo é a PRIMEIRA, e o motivo é uma
 *    falha minha ───────────────────────────────────────────────────────────
 *
 * Em 17/09 a SEC-031 moveu autorização para antes de validação em DUAS
 * funções. Eu tratei como dois casos isolados.
 *
 * O §1.3 é explícito: *"ao achar um bug, perguntar sempre: onde MAIS esse mesmo
 * padrão existe?"*. Não perguntei. No dia seguinte uma auditoria externa achou
 * `restore_post`, e a varredura que eu deveria ter feito na SEC-031 encontrou
 * **mais três** além dessa — inclusive uma que eu mesmo tinha escrito horas
 * antes, com o lookup antes da autorização, pelas minhas próprias mãos.
 *
 * Por isso a trava aqui **não lista as quatro funções**. Ela varre a classe: se
 * alguém escrever uma função nova com o padrão errado, ela reprova sozinha.
 * Trava que lista casos conhecidos protege contra o passado; trava que varre a
 * classe protege contra o próximo.
 *
 * ── A armadilha que a varredura tinha, e ela é a 8ª vez ───────────────────
 *
 * A primeira versão desta análise acusou CINCO funções, e uma delas era a que
 * eu tinha acabado de corrigir. Motivo: o comentário que eu escrevi na SEC-031
 * **cita** 'Usuário não encontrado' em prosa, e a busca leu comentário como
 * código.
 *
 * Ler prosa como se fosse código já me pegou sete vezes neste projeto. Por isso
 * `semComentarios()` roda ANTES de qualquer medida de posição — aqui e em
 * qualquer trava futura que olhe SQL.
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Tirar SEMPRE, antes de tudo. */
function semComentarios(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function migrationsEmOrdem() {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) {
    throw new Error(`Nenhuma migration em "${PASTA}" — a pasta mudou de lugar?`);
  }
  return nomes.map(n => semComentarios(readFileSync(join(PASTA, n), 'utf8')));
}

/** O corpo da ÚLTIMA definição de cada função, que é a que vale hoje. */
function corposDeFuncao() {
  const porNome = new Map();
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\$fn\$;/gi;
  for (const sql of migrationsEmOrdem()) {
    for (const m of sql.matchAll(re)) porNome.set(m[1], m[0]);
  }
  return porNome;
}

// Como a análise reconhece cada lado. Se uma função nova usar outro jeito de
// autorizar, ACRESCENTE aqui — não relaxe o teste.
const AUTORIZACAO = ['role_rank', 'is_staff', 'is_super', 'is_owner',
  'can_moderate_content', 'Acesso negado', 'Access denied'];
const EXISTENCIA = ['não encontrad', 'nao encontrad', 'not found'];

const primeiraPosicao = (texto, agulhas) => agulhas
  .map(a => texto.indexOf(a))
  .filter(i => i >= 0)
  .reduce((menor, i) => Math.min(menor, i), Infinity);

/**
 * As funções em que a autorização depende de LER o alvo primeiro, e por isso a
 * ordem não pode ser invertida. Elas fecham o oráculo de outro jeito: a
 * mensagem de "não existe" e a de "não é seu" são a MESMA.
 *
 * Cada entrada precisa do motivo escrito — sem isso, esta lista vira o lugar
 * onde alguém esconde uma função que só deu trabalho de arrumar.
 */
const AUTORIZA_PELO_ALVO = {
  solicitar_reativacao_da_propria_live:
    'so o DONO da live pede, e descobrir quem e o dono exige o lookup. Fecha '
    + 'unificando a mensagem: "Live nao encontrada ou nao e sua" cobre os dois.',
  soft_delete_post:
    'quem pode apagar depende de QUEM É O DONO, e descobrir o dono exige o '
    + 'lookup. Fecha unificando a mensagem: "Post não encontrado ou sem permissão".',
  // `[19/09]` SEC-045
  exige_alvo_apto:
    'NÃO é porta de entrada: `EXECUTE` é revogado de anon e authenticated, e '
    + 'ela só roda DEPOIS que a função chamadora (decide_role_demotion, '
    + 'review_staff_nomination, decide_staff_trial) já provou o cargo de quem '
    + 'chama. Como ninguém consegue invocá-la direto, a mensagem "Usuario nao '
    + 'encontrado" nunca chega a quem não estava autorizado — não há oráculo. '
    + 'Se algum dia ela ganhar GRANT para authenticated, esta exceção deixa de '
    + 'valer e a mensagem precisa ser unificada.',
};

describe('SEC-032 — autorização antes de existência, pela CLASSE', () => {
  const funcoes = corposDeFuncao();

  it('a varredura enxerga as migrations (senão passaria verde sem olhar nada)', () => {
    expect(funcoes.size, [
      'A varredura não encontrou definição de função nenhuma nas migrations.',
      'Ou o padrão do `CREATE OR REPLACE FUNCTION ... $fn$;` mudou, ou a pasta',
      'mudou de lugar. Sem esta guarda o teste abaixo ficaria VERDE para sempre',
      'sem nunca ter olhado uma linha.',
    ].join('\n')).toBeGreaterThan(20);
  });

  it('nenhuma função revela existência do alvo antes de autorizar', () => {
    const infratoras = [];

    for (const [nome, corpo] of funcoes) {
      if (nome in AUTORIZA_PELO_ALVO) continue;

      const posExistencia = primeiraPosicao(corpo, EXISTENCIA);
      if (posExistencia === Infinity) continue;           // não fala de existência

      const posAutorizacao = primeiraPosicao(corpo, AUTORIZACAO);
      if (posExistencia < posAutorizacao) infratoras.push(nome);
    }

    expect(infratoras, [
      `Função(ões) que contam se o alvo EXISTE antes de checar quem está chamando:`,
      ...infratoras.map(n => `  · ${n}`),
      '',
      'Nessa ordem, quem NÃO tem permissão distingue "esse id existe" de "esse id',
      'não existe" pelas duas mensagens diferentes — um laço em cima disso enumera',
      'contas ou posts. Foi o achado 06C da auditoria externa, e a varredura que o',
      'gerou encontrou mais TRÊS iguais.',
      '',
      'O conserto tem duas formas, e a escolha depende da função:',
      '',
      '  1. Se a permissão de quem chama NÃO depende do alvo (o caso comum):',
      '     suba a checagem de autorização para antes do lookup. Quem está',
      '     autorizado continua recebendo a mensagem útil.',
      '',
      '  2. Se a permissão DEPENDE do alvo (ex.: "só o dono apaga"): não dá para',
      '     autorizar antes de olhar. Aí unifique as mensagens — "não existe" e',
      '     "não é seu" passam a dizer a mesma coisa — e registre a função em',
      '     AUTORIZA_PELO_ALVO, NESTE arquivo, COM O MOTIVO.',
    ].join('\n')).toEqual([]);
  });

  it('a lista de exceções tem motivo escrito em cada entrada', () => {
    // Sem isto, AUTORIZA_PELO_ALVO vira o lugar onde se esconde uma função que
    // só deu trabalho de arrumar.
    for (const [nome, motivo] of Object.entries(AUTORIZA_PELO_ALVO)) {
      expect(motivo?.length ?? 0, `A exceção "${nome}" está sem motivo escrito.`)
        .toBeGreaterThan(40);
    }
  });
});

describe('SEC-033 — a resposta pertence ao mesmo post do pai', () => {
  const sqlTodo = migrationsEmOrdem().join('\n');

  it('a FK de `parent_id` é COMPOSTA com `post_id`', () => {
    expect(sqlTodo, [
      'A FK composta de `comments` sumiu.',
      '',
      'A FK simples (`parent_id REFERENCES comments(id)`) só garante que o pai',
      'EXISTE — não que ele esteja no MESMO post. Sem a composta, dá para criar',
      'uma resposta no Post B apontando para um comentário do Post A.',
      '',
      'O estrago não é vazamento: o `fetchComments` filtra por `post_id`, então o',
      'texto do pai nunca chega na tela. É pior de achar — o `rootIdOf` do',
      '`CommentSection` para quando o pai não está na lista e devolve o id do',
      'próprio órfão, que não é raiz. Ele NUNCA renderiza, mas o',
      '`fetchCommentCount` conta. O contador diz 3, a thread mostra 2.',
      '',
      'Restaure: FOREIGN KEY (parent_id, post_id) REFERENCES comments(id, post_id)',
    ].join('\n')).toMatch(
      /FOREIGN\s+KEY\s*\(\s*parent_id\s*,\s*post_id\s*\)\s*REFERENCES\s+(?:public\.)?comments\s*\(\s*id\s*,\s*post_id\s*\)/i);
  });
});

describe('SEC-034 — a live não fica em estado impossível nem vira spam', () => {
  const sqlTodo = migrationsEmOrdem().join('\n');
  const corpos = corposDeFuncao();

  it('reativar LIMPA a data de encerramento', () => {
    expect(corpos.get('set_live_ended_at'), [
      'O `set_live_ended_at` voltou a só GRAVAR a data de fim, sem limpá-la.',
      '',
      'Sem o ramo de reativação, um ciclo encerrar → reativar deixa o post assim:',
      '    is_live       = true      (está no ar)',
      '    live_ended_at = 12:46     (e terminou às 12:46)',
      '',
      'As duas não podem ser verdade juntas, e nada estoura: o card mostra',
      '"AO VIVO" e o selo de encerramento lê o mesmo campo.',
      '',
      'O ramo precisa existir: `NEW.live_ended_at := NULL` quando is_live vai de',
      'false para true.',
    ].join('\n')).toMatch(/live_ended_at\s*:=\s*NULL/i);
  });

  it('apagar o post encerra a live', () => {
    expect(corpos.get('set_live_ended_at'), [
      'Apagar o post voltou a NÃO encerrar a live.',
      '',
      'O `fetchActiveLives` filtra `is_live = true`, e a policy `posts_select`',
      'libera conteúdo apagado a partir de `role_rank >= 2` — então a live apagada',
      'continuava listada como "AO VIVO" **para quem é da equipe**, que é quem mais',
      'olha essa tela.',
      '',
      'É a regra do BANCO.md: toda ação de estado precisa da INVERSA e da LIMPEZA.',
      'A correção vale para QUALQUER caminho de apagamento, não só o que o',
      'frontend usa hoje — por isso ela mora no trigger.',
    ].join('\n')).toMatch(/NEW\.deleted_at\s+IS\s+NOT\s+NULL[\s\S]{0,120}NEW\.is_live\s*:=\s*false/i);
  });

  it('o estado impossível é impossível, não só improvável', () => {
    expect(sqlTodo, [
      'O CHECK `posts_live_no_ar_nao_tem_fim` sumiu.',
      '',
      'O trigger sozinho é UMA camada. A tabela do §2 é clara: constraint é a trava',
      'de 1ª força porque faz o dado errado ser IMPOSSÍVEL; trigger é 3ª, e um',
      'trigger desabilitado, renomeado, ou um caminho onde ele não dispare reabre',
      'o buraco em silêncio.',
      '',
      'O `COALESCE` não é enfeite: `is_live` é nullable, e `NOT (NULL AND ...)` dá',
      'NULL — que um CHECK aceita.',
    ].join('\n')).toMatch(/CHECK\s*\(\s*NOT\s*\(\s*COALESCE\s*\(\s*is_live/i);
  });

  it('notificação de live repetida vira CONTADOR, não linha nova', () => {
    expect(corpos.get('notify_admin_new_live'), [
      'A deduplicação das notificações de live sumiu.',
      '',
      'Cada `false → true` dispara `live_reactivated` para TODOS os admins. Um',
      'usuário comum alterna `is_live` no próprio post e enche o painel da equipe.',
      'Medido antes da correção: 36 das 116 notificações de admin eram de live —',
      '31% da tabela, geradas por um teste alternando o MESMO post.',
      '',
      'A 4ª regra do §0.2 pergunta: "quem pode disparar isto? Se a resposta inclui',
      '\'qualquer um da internet\', ele precisa de limite ANTES de existir."',
      '',
      'A dedup é a mesma do `record_banned_login_attempt` de propósito: 30 minutos,',
      'e o repetido vira "N vezes em 30 min" em vez de N linhas.',
    ].join('\n')).toMatch(/interval\s+'30 minutes'/i);
  });
});

describe('o frontend não lista live apagada', () => {
  it('`fetchActiveLives` filtra `deleted_at`', () => {
    const codigo = readFileSync('src/services/postService.js', 'utf8')
      .replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const trecho = /export async function fetchActiveLives[\s\S]*?\n}/.exec(codigo)?.[0];
    expect(trecho, 'A função `fetchActiveLives` sumiu do postService.').toBeTruthy();
    expect(trecho, [
      'O `fetchActiveLives` voltou a listar live apagada.',
      '',
      'O trigger já encerra a live ao apagar o post, então isto é a SEGUNDA camada.',
      'Ela existe porque a primeira correção deste projeto que dependeu de UM só',
      'mecanismo foi a do SEC-025, e a lição foi não repetir isso.',
      '',
      "Restaure: .is('deleted_at', null)",
    ].join('\n')).toMatch(/\.is\(\s*'deleted_at'\s*,\s*null\s*\)/);
  });
});
