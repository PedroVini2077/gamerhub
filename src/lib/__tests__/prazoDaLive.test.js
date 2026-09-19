import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[18/09]` LIVE-041 — o prazo da live, e o modo de segurança do guard.
 *
 * ── A trava que importa mais, e ela nasceu de um erro meu ─────────────────
 *
 * Escrevi `SECURITY DEFINER` no rascunho do `guard_post_privileged_cols`. Em
 * produção ele é **SECURITY INVOKER**, e isso é deliberado: ele lê
 * `current_user` para saber QUEM chama.
 *
 *     v_comum := current_user IN ('authenticated','anon') AND role_rank(...) < 2;
 *
 * Como `SECURITY DEFINER`, `current_user` vira o dono da função (`postgres`),
 * `v_comum` fica **sempre falso**, e toda a pinagem da SEC-027 desliga —
 * `was_live`, `expires_at`, `deleted_at`, `hidden_at`, `user_id` voltam a
 * aceitar valor forjado por PATCH na REST API.
 *
 * **E nada estoura.** A função continua existindo, o trigger continua
 * disparando, o INSERT continua passando. É §1.5 na forma mais cara: uma
 * correção de segurança inteira revertida por uma palavra, dentro de um commit
 * que dizia "prazo de live".
 *
 * O que pegou foi o teste em ROLLBACK (asserções 9, 10 e 11 reprovaram juntas),
 * e foi ao perguntar POR QUE que o `prosecdef = false` de produção apareceu.
 * Esta trava existe para a próxima pessoa não depender de ter essa sorte.
 *
 * ── A segunda: ONDE a derivação mora ──────────────────────────────────────
 *
 * A LIVE-039 foi exatamente este erro com `was_live`: a derivação ficou dentro
 * do ramo `v_comum`, e live criada por ADMIN nasceu sem o marcador — o cron
 * nunca a apagaria. Derivação vale para todo mundo; pinagem, só para o comum.
 *
 * ── A terceira: a lista da TELA × o `CHECK` do BANCO ──────────────────────
 *
 * Deriva clássica da Fase 4. Alguém acrescenta "7 dias" no seletor, o `CHECK`
 * recusa 10080, e ficar ao vivo passa a falhar com um erro cru de banco na
 * cara do usuário. Os dois lados precisam concordar para sempre.
 *
 * ── Provada reinjetando cada bug (§2) ─────────────────────────────────────
 *
 *   . posto `SECURITY DEFINER` na função      -> falha nomeando a SEC-027
 *   . movo a derivação para depois do v_comum -> falha nomeando a LIVE-039
 *   . tiro o pin de `live_duracao_minutos`    -> falha
 *   . ponho 10080 em `DURACOES`               -> falha citando o CHECK
 */

const PASTA = 'supabase/migrations';
const SELETOR = 'src/components/lives/LiveGoModal.jsx';

/**
 * Comentário de SQL é PROSA, e prosa cita comando — 10 vezes já.
 *
 * Aqui ela é especialmente perigosa: a migration da LIVE-041 explica o erro do
 * `SECURITY DEFINER` **escrevendo `SECURITY DEFINER` seis vezes** no comentário
 * do topo. Sem esta limpeza, a trava acusaria a própria explicação de ser o bug.
 */
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

/** O corpo da ÚLTIMA definição do guard, que é a que vale hoje. */
function guardAtual() {
  let corpo = null;
  for (const sql of migrationsEmOrdem()) {
    const achados = sql.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?guard_post_privileged_cols[\s\S]*?\$fn\$\s*;/gi);
    if (achados) corpo = achados[achados.length - 1];
  }
  if (!corpo) throw new Error('O `guard_post_privileged_cols` sumiu das migrations.');
  return corpo;
}

describe('LIVE-041 — o guard e o prazo da live', () => {
  const guard = guardAtual();

  it('o guard NÃO é `SECURITY DEFINER` — senão a SEC-027 inteira desliga', () => {
    expect(/SECURITY\s+DEFINER/i.test(guard), [
      'O `guard_post_privileged_cols` virou `SECURITY DEFINER`.',
      '',
      'Isso NÃO é endurecimento — é o oposto. A função decide se está diante de',
      'um usuário comum lendo `current_user`:',
      '',
      "    v_comum := current_user IN ('authenticated','anon') AND role_rank(...) < 2",
      '',
      'Como DEFINER, `current_user` vira o DONO da função (`postgres`), então',
      '`v_comum` é sempre falso e a pinagem inteira para de rodar: `was_live`,',
      '`expires_at`, `deleted_at`, `hidden_at` e `user_id` voltam a aceitar',
      'valor forjado por PATCH direto na REST API.',
      '',
      'E nada estoura — o trigger continua disparando e o INSERT continua',
      'passando. Foi assim que os achados GH-XP-LIVE-001/002/011 e 8/9/10 do',
      'pentest existiam.',
      '',
      'Se você precisa de privilégio elevado para alguma leitura nova dentro do',
      'guard, o caminho é uma função auxiliar `SECURITY DEFINER` chamada por ele',
      '(com REVOKE, ver SEC-042) — não mudar o modo do guard.',
    ].join('\n')).toBe(false);
  });

  it('TODA derivação acontece antes do recorte de `v_comum` (a lição da LIVE-039)', () => {
    const ondeRecorta = guard.search(/v_comum\s*:=/);
    expect(ondeRecorta, 'O recorte `v_comum` sumiu do guard.').toBeGreaterThan(-1);

    // Medir a PRIMEIRA derivação não bastava, e isto foi provado: ao mover a
    // derivação do INSERT para dentro do ramo do comum, a do ramo de REATIVAÇÃO
    // continuava acima do corte e o teste passava verde com o bug presente.
    // A regra é sobre TODAS elas, então a medida tem que ser sobre todas.
    const derivacoes = [
      ...guard.matchAll(/NEW\.(?:expires_at|was_live)\s*:=\s*(?:CASE|COALESCE|OLD\.was_live)/g),
    ].map(m => m.index);

    expect(derivacoes.length, [
      'A trava não achou derivação nenhuma no guard — o formato mudou.',
      'Ela procura `NEW.expires_at :=` / `NEW.was_live :=` seguidos de CASE,',
      'COALESCE ou OLD.was_live.',
    ].join('\n')).toBeGreaterThan(2);

    const abaixoDoCorte = derivacoes.filter(i => i > ondeRecorta);

    expect(abaixoDoCorte, [
      'A derivação do prazo caiu DENTRO do ramo de usuário comum.',
      '',
      'Esse é o bug da LIVE-039, de novo: lá a derivação de `was_live` ficou no',
      'ramo do comum e a live criada por ADMIN nasceu com `was_live = false` —',
      'o cron nunca a apagaria, e o feed ia acumulando card com embed morto.',
      '',
      'A regra: DERIVAR vale para todo mundo; PINAR só vale para o comum.',
      'Tudo que for `NEW.<coluna> := <cálculo>` fica ACIMA da linha',
      '`v_comum := ...`.',
    ].join('\n')).toEqual([]);
  });

  it('`live_duracao_minutos` é pinada no UPDATE do usuário comum', () => {
    expect(guard, [
      'O guard parou de pinar `live_duracao_minutos`.',
      '',
      'Sem isso o autor estica a própria live por PATCH direto. Hoje a duração',
      'só vira prazo na abertura e na reativação, então o estrago é limitado —',
      'mas "só está seguro por efeito colateral de outra regra" é a proteção',
      'acidental que o §1.3 manda desconfiar.',
      '',
      'A duração é a INTENÇÃO registrada na abertura. Esticar a live depois é',
      'uma ação nova, com regras próprias — não um UPDATE de coluna.',
    ].join('\n')).toMatch(/NEW\.live_duracao_minutos\s*:=\s*OLD\.live_duracao_minutos/i);
  });

  it('o CHECK da faixa existe e é o teto de 24h', () => {
    const sql = migrationsEmOrdem().join('\n');
    expect(sql, [
      'O `CHECK` da faixa de `live_duracao_minutos` sumiu.',
      '',
      'Validação de tela não substitui: o site usa a anon key, e um POST direto',
      'na REST API com 500000 minutos passaria. O teto de 1440 é o MESMO que o',
      'cron `expire-lives` já impunha — o número não é novo, ele só deixou de',
      'ser invisível.',
    ].join('\n')).toMatch(/live_duracao_minutos\s+BETWEEN\s+15\s+AND\s+1440/i);
  });
});

describe('LIVE-041 — a tela concorda com o banco (deriva de Fase 4)', () => {
  it('toda duração oferecida no seletor cabe na faixa do `CHECK`', () => {
    const jsx = readFileSync(SELETOR, 'utf8');
    const bloco = jsx.match(/const\s+DURACOES\s*=\s*\[([\s\S]*?)\];/);

    expect(bloco, [
      `A lista \`DURACOES\` sumiu de ${SELETOR}.`,
      'Sem ela esta trava não olha nada — e passaria verde para sempre.',
    ].join('\n')).toBeTruthy();

    const minutos = [...bloco[1].matchAll(/minutos:\s*(null|\d+)/g)]
      .map(m => (m[1] === 'null' ? null : Number(m[1])));

    expect(minutos.length, [
      'A trava não achou NENHUMA duração na lista — o formato mudou.',
      'Ela espera itens no formato `{ minutos: <número|null>, label: ... }`.',
    ].join('\n')).toBeGreaterThan(1);

    const foraDaFaixa = minutos.filter(m => m !== null && (m < 15 || m > 1440));

    expect(foraDaFaixa, [
      `O seletor oferece duração que o banco RECUSA: ${foraDaFaixa.join(', ')}.`,
      '',
      'O `CHECK posts_live_duracao_faixa` aceita 15..1440 (24h). Uma opção fora',
      'disso não vira "live sem prazo": vira **erro cru de banco na cara de quem',
      'clicou em Iniciar live**, porque o INSERT inteiro é recusado.',
      '',
      'Para oferecer mais do que 24h, o teto do `CHECK` E o do cron',
      '`expire-lives` precisam mudar juntos — são a mesma regra escrita em dois',
      'lugares, e é decisão de produto, não ajuste de lista.',
    ].join('\n')).toEqual([]);
  });
});
