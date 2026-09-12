import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * As travas do SEC-012 — apagar a conta exige a SENHA, conferida no servidor.
 *
 * ── O bug ───────────────────────────────────────────────────────────────────
 *
 * `delete_own_account()` era uma linha: `DELETE FROM auth.users WHERE id =
 * auth.uid()`. A ação mais destrutiva e **irreversível** do site acontecia
 * atrás de dois `ConfirmModal` — validação de CLIENTE, que o §1.3 diz não valer
 * nada, porque a `anon key` permite chamar `/rest/v1/rpc/delete_own_account`
 * direto e pular a tela inteira.
 *
 * ── Por que a trava olha a MIGRATION, e não só o cliente ────────────────────
 *
 * Porque a proteção mora no banco. Um teste que só conferisse a tela passaria
 * verde com a RPC aberta — exatamente o tipo de portão que ensina a confiar num
 * sinal que não sustenta nada (§6.3).
 *
 * A migration é o único artefato **no repositório** que descreve o estado do
 * banco. O espelho é obrigatório e tem portão próprio no CI, então ele é fonte
 * confiável aqui.
 */

const RAIZ = 'supabase/migrations';

/**
 * O SQL **sem os comentários**, e isto não é detalhe de implementação.
 *
 * A primeira versão desta trava reprovou dizendo *"a conferência de senha vem
 * DEPOIS do DELETE"* — e estava lendo o `DELETE FROM auth.users` que aparece no
 * **comentário** do topo da migration, onde ele é citado para explicar o bug
 * antigo. Posição 225 do arquivo, dentro da prosa.
 *
 * É o quinto caso registrado neste projeto do mesmo erro: **a trava lê o texto
 * que explica a regra em vez do código que a cumpre**, e passa (ou reprova) por
 * um motivo que não tem nada a ver com o sistema. Tirar o comentário antes de
 * medir é o que faz a trava olhar para o lugar certo.
 */
const semComentarios = (sql) => sql.replace(/--[^\n]*/g, '');

const MIGRATIONS = readdirSync(RAIZ)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => {
    const bruto = readFileSync(join(RAIZ, f), 'utf8');
    return { nome: f, sql: semComentarios(bruto), bruto };
  });

const FONTE = (c) => readFileSync(c, 'utf8');

/**
 * O JS **sem comentários**, pelo mesmo motivo do SQL — e a prova de que a
 * armadilha é sistemática e não descuido: a segunda versão desta trava reprovou
 * dizendo *"o `logAudit` voltou para a tela"*, lendo o parágrafo do
 * `ZonaDePerigo.jsx` que explica **por que ele saiu**.
 *
 * Duas vezes seguidas, no mesmo teste, em linguagens diferentes. A regra que
 * fica: **trava que procura um nome procura a CHAMADA, não a palavra** — aqui,
 * `logAudit(` depois de tirar o comentário.
 */
const codigoDe = (c) => readFileSync(c, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/[^\n]*/gm, '');

describe('apagar a conta exige a senha', () => {
  it('a varredura enxerga as migrations — senão ela não trava nada', () => {
    // Sem isto, renomear a pasta deixa o teste verde sobre zero arquivos.
    expect(
      MIGRATIONS.length,
      'A varredura não achou migration nenhuma. O caminho mudou e a trava\n'
      + '  ficou vazia — que é pior do que não existir.',
    ).toBeGreaterThan(100);
  });

  it('a versão SEM senha foi APAGADA do banco, não só substituída', () => {
    // A parte que faz o conserto valer. Criar a versão com senha e deixar a
    // antiga no ar manteria a porta aberta ao lado da nova: o PostgREST expõe
    // as duas, e quem chamar sem argumento continua apagando a conta.
    const dropou = MIGRATIONS.some((m) =>
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.delete_own_account\s*\(\s*\)/i.test(m.sql));
    expect(
      dropou,
      'Nenhuma migration apaga a `delete_own_account()` SEM argumento.\n'
      + '  Sem o DROP, o PostgREST expõe as duas versões e a antiga continua\n'
      + '  apagando contas sem pedir nada. A correção vira decoração.',
    ).toBe(true);
  });

  it('a versão que existe confere a senha ANTES do delete', () => {
    const criacoes = MIGRATIONS.filter((m) =>
      /FUNCTION\s+public\.delete_own_account\s*\(\s*p_senha/i.test(m.sql));
    expect(
      criacoes.length,
      'Não achei a criação de `delete_own_account(p_senha)`.',
    ).toBeGreaterThan(0);

    const corpo = criacoes[criacoes.length - 1].sql;
    const ondeConfere = corpo.search(/a_senha_confere\s*\(\s*p_senha\s*\)/);
    const ondeApaga = corpo.search(/DELETE\s+FROM\s+auth\.users/i);

    expect(ondeConfere, 'A função não confere a senha em lugar nenhum.').toBeGreaterThan(-1);
    expect(
      ondeConfere < ondeApaga,
      'A conferência de senha vem DEPOIS do `DELETE`.\n'
      + '  Nessa ordem ela não protege coisa nenhuma — a conta já foi.',
    ).toBe(true);
  });

  it('a trilha é gravada ANTES do delete, e não pelo cliente', () => {
    // `[12/09]` Conserto de uma falha silenciosa: o `logAudit` ficava na tela e
    // rodava DEPOIS de a conta sumir, ou seja como um usuário que já não
    // existe. A trilha da própria exclusão podia se perder sem ninguém notar.
    const criacoes = MIGRATIONS.filter((m) =>
      /FUNCTION\s+public\.delete_own_account\s*\(\s*p_senha/i.test(m.sql));
    const corpo = criacoes[criacoes.length - 1].sql;
    const ondeLoga = corpo.search(/INSERT\s+INTO\s+admin_logs/i);
    const ondeApaga = corpo.search(/DELETE\s+FROM\s+auth\.users/i);

    expect(ondeLoga, 'A exclusão de conta não grava trilha nenhuma.').toBeGreaterThan(-1);
    expect(
      ondeLoga < ondeApaga,
      'A trilha é gravada DEPOIS do `DELETE`.\n'
      + '  Nessa ordem o ator já não existe, e o registro pode simplesmente não\n'
      + '  acontecer — sem erro, que é o pior tipo de falha (§1.5).',
    ).toBe(true);

    const zona = codigoDe('src/components/conta/ZonaDePerigo.jsx');
    expect(
      /logAudit\s*\(/.test(zona),
      'O `logAudit` voltou para a tela da exclusão.\n'
      + '  Ele roda depois de a conta ser apagada, como um usuário que já não\n'
      + '  existe. Quem grava é a RPC, antes do delete.',
    ).toBe(false);
  });

  it('o auxiliar de senha NÃO é chamável pela REST', () => {
    // `a_senha_confere` sem `is_super()` seria um oráculo de senha sem limite
    // de tentativa se ficasse exposto. As duas que o usam são `SECURITY
    // DEFINER` e rodam como o dono, então o EXECUTE é checado contra ele.
    const revogou = MIGRATIONS.some((m) =>
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.a_senha_confere\s*\(\s*text\s*\)\s+FROM[^;]*authenticated/i
        .test(m.sql));
    expect(
      revogou,
      'O auxiliar `a_senha_confere` não foi revogado de `authenticated`.\n'
      + '  Exposto na REST ele vira um verificador de senha sem limite de\n'
      + '  tentativa. Ele existe só para as duas RPCs que o chamam por dentro.',
    ).toBe(true);
  });

  it('a tela manda a senha para a RPC', () => {
    expect(
      /rpc\(\s*'delete_own_account'\s*,\s*\{\s*p_senha/.test(FONTE('src/services/authService.js')),
      'O cliente voltou a chamar `delete_own_account` sem a senha.\n'
      + '  A RPC recusa, então o botão de apagar conta simplesmente para de\n'
      + '  funcionar — e o defeito só aparece para quem tentar apagar a conta.',
    ).toBe(true);
  });
});
