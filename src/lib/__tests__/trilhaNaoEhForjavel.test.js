/**
 * TRAVA: a lista de actions que o cliente pode registrar não pode envelhecer.
 *
 * ── O achado que deu origem a ela (Fase 2, 05/09) ───────────────────────────
 *
 * `log_audit_event` aceitava qualquer coisa de qualquer pessoa logada.
 * Comprovado em `ROLLBACK`: um perfil `role = 'user'` gravou
 * `action = 'admin_ban'`, `details = '@vitima foi banida'`,
 * `severity = 'critical'` em `admin_logs`.
 *
 * O `actor_id` sempre veio de `auth.uid()`, então ninguém se passava por outro.
 * Mas o resto era texto livre — e a trilha é a fonte de verdade que a equipe usa
 * para decidir o que aconteceu no site.
 *
 * A correção fechou a lista no banco. Só que uma lista fechada cria um risco
 * novo, e é ESSE que este teste existe para cobrir.
 *
 * ── Por que a recusa em produção é INVISÍVEL ────────────────────────────────
 *
 * `lib/auditLog.js` engole o erro de propósito — "logging nunca deve quebrar o
 * fluxo principal", e isso está certo. A consequência é que, se alguém
 * acrescentar uma `logAudit('acao_nova')` no cliente e esquecer de acrescentar
 * no banco, o registro **simplesmente não acontece**:
 *
 *   - a pessoa não vê nada;
 *   - nada é gravado (é justamente o que falhou);
 *   - nenhum teste de comportamento quebra.
 *
 * São as três respostas "nada" do teste dos três canais (§1.5). Por isso a
 * verificação tem que acontecer ANTES, no CI — não em runtime.
 *
 * ── O que ela compara ───────────────────────────────────────────────────────
 *
 * Todo literal passado a `logAudit()` (e aos ajudantes locais `log()` e
 * `done()`, que já enganaram a rede uma vez) contra as duas listas escritas
 * dentro da migration mais recente que define a função.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { varrerFontes } from './varrerFontes';

const DIR = 'supabase/migrations';

/** As duas listas da função, lidas da migration que a define por último. */
function listasDoBanco() {
  const arquivos = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => /create\s+(or\s+replace\s+)?function[\s\S]{0,120}log_audit_event/i
      .test(readFileSync(`${DIR}/${f}`, 'utf8')))
    .sort();

  expect(
    arquivos.length,
    `nenhuma migration em ${DIR} define log_audit_event — o nome mudou?`,
  ).toBeGreaterThan(0);

  const sql = readFileSync(`${DIR}/${arquivos.at(-1)}`, 'utf8');

  const pegar = (nome) => {
    const bloco = new RegExp(`${nome}[^=]*:=\\s*ARRAY\\[([^\\]]*)\\]`, 'i').exec(sql);
    expect(bloco, `a migration não tem a lista \`${nome}\``).not.toBeNull();
    return [...bloco[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };

  return { proprias: pegar('c_proprias'), deEquipe: pegar('c_de_equipe') };
}

/** Toda action que o CLIENTE manda para a trilha. */
function actionsDoCliente() {
  const padroes = [
    /logAudit\(\s*\n?\s*'([a-z_]+)'/g,
    // Os ajudantes locais do painel. Eles já furaram a rede uma vez: quando os
    // hooks do Admin foram extraídos, oito actions sumiram da cobertura sem
    // ninguém notar, porque a varredura só conhecia `logAudit(`.
    /\blog\(\s*\n?\s*'([a-z_]+)'/g,
    /\bdone\([^,]+,\s*\n?\s*'([a-z_]+)'/g,
  ];

  const achadas = new Set();
  for (const caminho of varrerFontes('src')) {
    const codigo = readFileSync(caminho, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const padrao of padroes) {
      for (const m of codigo.matchAll(padrao)) achadas.add(m[1]);
    }
  }
  return [...achadas].sort();
}

describe('a trilha de auditoria não é forjável', () => {
  it('toda action que o cliente registra é aceita pelo banco', () => {
    const { proprias, deEquipe } = listasDoBanco();
    const aceitas = new Set([...proprias, ...deEquipe]);
    const doCliente = actionsDoCliente();

    expect(doCliente.length, 'a varredura não achou action nenhuma em src/')
      .toBeGreaterThan(20);

    expect(
      doCliente.filter((a) => !aceitas.has(a)),
      'o cliente registra action que o banco RECUSA.\n'
      + 'Em producao isso nao aparece: `logAudit` engole o erro, entao o\n'
      + 'registro simplesmente nao acontece — ninguem ve, nada e gravado e\n'
      + 'nenhum teste de comportamento quebra (§1.5).\n'
      + 'Acrescente a action em `c_proprias` (qualquer pessoa logada) ou em\n'
      + '`c_de_equipe` (exige cargo) na migration de log_audit_event.',
    ).toEqual([]);
  });

  it('as ações de equipe são só as que nascem em painel', () => {
    const { proprias, deEquipe } = listasDoBanco();

    // O dono do post, do comentário, da mensagem do mural e da LIVE moderam o
    // que é deles sem ser equipe (`canModerateLive` em `lib/roles.js`). Pôr
    // qualquer uma destas em `c_de_equipe` faria o registro sumir em silêncio
    // justamente para o usuário comum — que é quem mais as dispara.
    for (const acao of ['post_deleted', 'comment_deleted', 'mural_delete',
      'live_chat_delete', 'live_silence']) {
      expect(
        deEquipe.includes(acao),
        `"${acao}" foi movida para c_de_equipe, e ela NAO e so de equipe:\n`
        + 'o dono do proprio conteudo (e o dono da live) a dispara. Exigir\n'
        + 'cargo ali perde o registro EM SILENCIO para o usuario comum.',
      ).toBe(false);
      expect(proprias.includes(acao), `"${acao}" sumiu das duas listas`).toBe(true);
    }
  });

  it('nenhuma action escrita PELO BANCO entra na lista do cliente', () => {
    const { proprias, deEquipe } = listasDoBanco();
    const aceitas = new Set([...proprias, ...deEquipe]);

    // Estas nascem dentro de funções privilegiadas do Postgres. Se alguma
    // entrar na lista do cliente, volta a ser forjável — que era o achado.
    for (const acao of ['admin_ban', 'auto_ban', 'auto_suspend', 'user_suspended',
      'user_unsuspended', 'ai_moderation_hidden', 'auth_permanent_block',
      'content_report_created', 'edge_function_error']) {
      expect(
        aceitas.has(acao),
        `"${acao}" e gravada pelo BANCO e entrou na lista do cliente.\n`
        + 'Isso devolve o achado da Fase 2: qualquer pessoa logada volta a\n'
        + 'poder escrever essa linha na trilha que a equipe usa para decidir.',
      ).toBe(false);
    }
  });
});
