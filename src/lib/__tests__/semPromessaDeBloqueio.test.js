import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A tela de entrada NÃO promete um bloqueio que o sistema não faz.
 *
 * ── O que aconteceu, e por quanto tempo ─────────────────────────────────────
 *
 * `[11/09]` Por 14 dias o site disse *"Conta bloqueada por excesso de
 * tentativas"* numa tela em que isso **nunca podia acontecer**:
 *
 *   28/08  a contagem forjável é removida — ela era chamável por anônimo, e
 *          bastava um script com o e-mail da vítima para trancar a conta dela
 *          sem nunca saber a senha;
 *   28/08  entra o `hook_de_verificacao_de_senha`, que seria o substituto;
 *   11/09  medido: `login_attempts` com **0 linhas** e nenhum `run_hook` nos
 *          logs do GoTrue. O Password Verification Attempt é **exclusivo dos
 *          planos pagos** — no Free ele não existe.
 *
 * O custo não era só a mensagem: a cada falha de login a página ia ao banco
 * perguntar por um contador que só podia responder "não bloqueado", e a cada
 * login bem-sucedido zerava uma tabela sempre vazia. **Duas idas ao banco por
 * login, por uma funcionalidade que não existia.**
 *
 * ── Por que uma trava, e não só o conserto ──────────────────────────────────
 *
 * Porque a promessa é fácil de voltar: qualquer pessoa relendo o
 * `get_blocked_logins` do painel conclui, com razão, que existe bloqueio — e
 * reescreve o aviso na tela de login. O que falta não é a tela; é **alguém que
 * escreva em `login_attempts`**.
 *
 * ── Como desfazer isto de forma legítima ────────────────────────────────────
 *
 * O dia em que existir um mecanismo real — o plano pago, ou uma RPC de bloqueio
 * MANUAL pela equipe —, apague este arquivo **no mesmo PR** que o cria. A trava
 * cai junto com o motivo dela, e não antes.
 */

const PROMESSAS = [
  /excesso de tentativas/i,
  /muitas tentativas falhas/i,
  /tentativas até o bloqueio/i,
];

/** As RPCs do contador. Chamá-las do cliente é a assinatura do retorno. */
const RPCS_DO_CONTADOR = ['check_login_status', 'reset_login_attempts'];

/** Onde a pessoa que não é da equipe olha. O painel da equipe fica de fora. */
const TELAS_DE_ENTRADA = [
  'src/pages/Login.jsx',
  'src/components/auth',
];

function arquivosDe(alvo) {
  if (statSync(alvo).isFile()) return [alvo];
  return readdirSync(alvo)
    .map((n) => join(alvo, n))
    .filter((c) => statSync(c).isFile() && /\.jsx?$/.test(c));
}

describe('a tela de entrada não promete bloqueio por tentativas', () => {
  const arquivos = TELAS_DE_ENTRADA.flatMap(arquivosDe);

  // Sem isto, renomear `components/auth` deixaria a lista vazia e todos os
  // `it` abaixo passariam por vacuidade — a trava viraria decoração.
  it('encontrou os arquivos da tela de entrada', () => {
    expect(
      arquivos.length,
      'Nenhum arquivo encontrado em ' + TELAS_DE_ENTRADA.join(', ')
      + '. Se a tela mudou de lugar, ajuste TELAS_DE_ENTRADA — senão este '
      + 'arquivo inteiro passa a aprovar tudo sem olhar nada.',
    ).toBeGreaterThanOrEqual(4);
  });

  it.each(arquivos)('%s não anuncia bloqueio por tentativas', (caminho) => {
    const fonte = readFileSync(caminho, 'utf8');
    // Só o que a PESSOA lê: comentário explicando a história é bem-vindo.
    const semComentarios = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const promessa of PROMESSAS) {
      expect(
        semComentarios,
        `${caminho} voltou a prometer bloqueio por tentativas (${promessa}).\n`
        + '  Isso só é verdade se ALGUÉM escrever em `login_attempts`, e hoje\n'
        + '  ninguém escreve: o Password Verification Hook é exclusivo dos\n'
        + '  planos pagos, e a contagem pelo cliente foi removida em 28/08 por\n'
        + '  ser forjável (qualquer um trancava a conta de qualquer e-mail).\n'
        + '  Se o mecanismo passou a existir, apague esta trava NO MESMO PR.',
      ).not.toMatch(promessa);
    }
  });

  it.each(arquivos)('%s não consulta o contador a cada login', (caminho) => {
    const fonte = readFileSync(caminho, 'utf8');
    const semComentarios = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const rpc of RPCS_DO_CONTADOR) {
      expect(
        semComentarios,
        `${caminho} voltou a chamar \`${rpc}\` na tela de entrada.\n`
        + '  Essa RPC só pode responder "não bloqueado" enquanto nada escrever\n'
        + '  em `login_attempts` — então é uma ida ao banco por login, de graça.\n'
        + '  O painel da equipe continua usando `get_blocked_logins`, e isso\n'
        + '  está certo: lá é leitura sob demanda, não a cada entrada.',
      ).not.toContain(rpc);
    }
  });
});
