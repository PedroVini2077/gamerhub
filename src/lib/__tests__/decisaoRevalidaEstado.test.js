import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[19/09]` SEC-044 / SEC-045 — decisão administrativa não confia em snapshot.
 *
 * ── A família, e ela é uma só ─────────────────────────────────────────────
 *
 * Sete achados de uma auditoria externa (N25, N26, N27, N32, N38, N39, N41)
 * descrevem a mesma coisa por sete ângulos: **uma autorização criada para um
 * estado antigo agindo sobre um estado novo.**
 *
 * O projeto já tinha o princípio certo em outro lugar. O N40 — perder
 * privilégio no meio do fluxo — foi PASS porque a autorização do CHAMADOR é
 * recalculada na decisão. Faltava aplicar o mesmo ao ALVO e ao ESTADO:
 *
 *     autorização do chamador ... recalculada   -> N40 PASS
 *     estado do alvo ............ snapshot      -> N25/N26/N27 falha
 *     geração do ban ............ inexistente   -> N41 falha
 *
 * ── O pior deles, medido ─────────────────────────────────────────────────
 *
 *     BAN A -> pedido de revisão -> unban -> BAN B -> aprovar o pedido velho
 *     resultado: "REMOVIDO — pedido velho matou ban novo"
 *
 * ── Por que `ban_count` e não `banned_at` ────────────────────────────────
 *
 * Minha primeira versão usou `banned_at`, e o teste REPROVOU: `now()` em
 * PostgreSQL é a hora da TRANSAÇÃO, não do comando, então dois bans na mesma
 * transação recebem o mesmo instante. A guarda comparava dois valores iguais e
 * teria ficado no código **parecendo** proteger.
 *
 * `ban_count` é incrementado por `ban_user` e por `apply_mod_auto_ban` — muda
 * por banimento, não por relógio.
 *
 * ── Provada reinjetando cada bug (§2) ────────────────────────────────────
 *
 *   . tiro a conferência de geração do approve  -> falha nomeando o N41
 *   . tiro o índice único parcial               -> falha nomeando a corrida
 *   . tiro `exige_alvo_apto` de uma das três    -> falha nomeando a função
 *   . `ban_geracao` volta a ser timestamp       -> falha explicando o `now()`
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 10 vezes. */
const SQL = (() => {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes
    .map(n => readFileSync(join(PASTA, n), 'utf8')
      .replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' '))
    .join('\n');
})();

describe('SEC-044 — a decisão é vinculada à GERAÇÃO do banimento', () => {
  it('a coluna `ban_geracao` existe', () => {
    expect(SQL, [
      'A coluna `ban_geracao` sumiu de `unban_requests`.',
      'Sem ela o pedido não sabe de QUAL banimento ele é, e um pedido antigo',
      'volta a poder remover um banimento novo (N41).',
    ].join('\n')).toMatch(/unban_requests\s+ADD\s+COLUMN[^;]*ban_geracao/i);
  });

  it('a geração é `ban_count`, NÃO um timestamp', () => {
    const trigger = SQL.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?marcar_geracao_do_ban[\s\S]*?\$fn\$[\s\S]*?\$fn\$/gi);
    expect(trigger, 'A função `marcar_geracao_do_ban` sumiu.').toBeTruthy();

    expect(trigger[trigger.length - 1], [
      'A geração do ban voltou a sair de um TIMESTAMP.',
      '',
      'Isso não funciona, e foi medido: `now()` em PostgreSQL é a hora da',
      'TRANSAÇÃO, não do comando. Dois bans na mesma transação recebem o MESMO',
      '`banned_at`, a comparação encontra dois valores iguais, e a guarda passa.',
      '',
      'Ela ficaria no código parecendo proteger — que é pior do que não existir.',
      '',
      'Use `ban_count`, que é incrementado por `ban_user` E por',
      '`apply_mod_auto_ban`: ele muda por BANIMENTO, não por relógio.',
    ].join('\n')).toMatch(/ban_count/i);
  });

  it('a geração é DERIVADA por trigger, não declarada pelo cliente', () => {
    expect(SQL, [
      'O trigger `trg_geracao_do_ban` sumiu.',
      '',
      'Sem ele a geração teria que ser preenchida por quem cria o pedido — e são',
      'DOIS caminhos (`request_unban` e `solicitar_revisao_do_proprio_ban`).',
      'Um deles esqueceria, e o esquecimento seria silencioso.',
    ].join('\n')).toMatch(/CREATE\s+TRIGGER\s+trg_geracao_do_ban\s+BEFORE\s+INSERT/i);
  });

  it('a corrida do N34 é impossível, não só improvável', () => {
    expect(SQL, [
      'O índice único parcial de `unban_requests` sumiu.',
      '',
      '`request_unban` faz `IF EXISTS ... INSERT`, sem nada atômico entre os',
      'dois — duas chamadas simultâneas criam dois pedidos pendentes.',
      '',
      'O índice não torna a corrida improvável: torna o resultado dela',
      'IMPOSSÍVEL. É trava de 1ª força, e foi o que permitiu fechar o achado sem',
      'depender de reproduzir concorrência.',
    ].join('\n')).toMatch(/UNIQUE\s+INDEX[^;]*unban_requests[^;]*WHERE\s+status\s*=\s*'pending'/i);
  });

  it('o unban limpa a suspensão junto (N33/N42)', () => {
    expect(SQL, [
      'O unban voltou a deixar `suspended_until` para trás.',
      '',
      'Medido: suspenso 10 dias -> banido -> desbanido. O admin vê',
      '`banned = false`, a pessoa continua sem conseguir publicar, e ninguém',
      'sabe por quê. É §1.5 exato — a tela diz uma coisa e o sistema faz outra.',
      '',
      'Regra de produto: o ban ABSORVE a suspensão, e o unban limpa as duas.',
      'Quem quiser manter reaplica, que é ato visível com log e hierarquia.',
      '',
      // Procurar `suspended_until = NULL` solto NAO servia, e isso foi provado:
      // o `lift_suspension` tambem limpa a coluna, legitimamente, entao a
      // asercao passava verde com o bug reinjetado. Ela precisa casar com a
      // EDICAO da SEC-044 — o par exato que injeta a limpeza no UPDATE do unban.
    ].join('\n')).toMatch(
      /ban_details\s*=\s*NULL,\s*suspended_until\s*=\s*NULL,'\)/i,
    );
  });
});

describe('SEC-045 — a decisão revalida o ALVO', () => {
  it('`exige_alvo_apto` existe', () => {
    expect(SQL, [
      'A função `exige_alvo_apto` sumiu.',
      'Ela é a irmã do `exige_operador_ativo`: uma cuida de quem CHAMA, a outra',
      'de quem é o ALVO.',
    ].join('\n')).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?exige_alvo_apto/i);
  });

  const REVALIDAM = [
    ['decide_role_demotion',    'N26/N38', 'o cargo do alvo muda entre o pedido e a decisão, e o rebaixamento é aplicado sobre um estado que já não existe'],
    ['review_staff_nomination', 'N25',     'o candidato é BANIDO depois da indicação, e a aprovação o promove assim mesmo'],
    ['decide_staff_trial',      'N27',     'o candidato é BANIDO durante a avaliação, e a confirmação o efetiva assim mesmo'],
  ];

  it.each(REVALIDAM)('a edição de `%s` continua na migration (%s)', (fn, id, oQue) => {
    const bloco = SQL.match(new RegExp(`exige_alvo_apto[^;]*;[^$]*?`, 'g')) || [];
    const citada = SQL.includes(fn) && bloco.length > 0;

    expect(citada, [
      `A revalidação de \`${fn}\` sumiu (achado ${id}).`,
      '',
      `Sem ela, ${oQue}.`,
      '',
      'A edição é feita por `replace()` sobre o texto atual da função, com a',
      'âncora conferida antes — se a âncora mudar, a migration levanta em vez de',
      'aplicar pela metade. Se você mexeu na função, confira se a âncora',
      'sobreviveu.',
    ].join('\n')).toBe(true);

    // a chamada tem que existir de fato, e para a funcao certa
    const re = new RegExp(`${fn}[\\s\\S]{0,1200}?exige_alvo_apto`, 'i');
    expect(SQL, `A chamada de \`exige_alvo_apto\` não aparece perto de \`${fn}\`.`).toMatch(re);
  });

  it('só o caminho que AVANÇA revalida — rejeitar continua possível', () => {
    expect(SQL, [
      'A revalidação passou a rodar em qualquer decisão.',
      '',
      'Isso trava a fila: negar a indicação de alguém que foi banido no meio',
      'passaria a ser impossível, e o item ficaria pendente para sempre — troca',
      'de um bug por outro.',
      '',
      "As chamadas são guardadas por `if p_decision = 'approve'` / `'confirm'`.",
      // As aspas aparecem DOBRADAS no arquivo: a chamada esta dentro de uma
      // string SQL (`replace(d, '...', '...')`), entao o texto cru traz
      // `''approve''`. Escrever `'approve'` aqui fazia a trava reprovar o
      // codigo certo — foi o que aconteceu na 1a execucao.
    ].join('\n')).toMatch(/p_decision\s*=\s*''(approve|confirm)''\s*then\s*perform\s+public\.exige_alvo_apto/i);
  });
});
