import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from '../../../lib/__tests__/varrerFontes';

/**
 * Trava do defeito que o dono achou em 03/09 testando o canal de contato:
 * *"como vou clicar no respondido sendo que não tem como responder nada?"*.
 *
 * ── O que estava errado, e não era falta de feature ─────────────────────────
 *
 * O status `answered` existia desde 02/09 e **nada no sistema enviava resposta
 * nenhuma**. O painel tinha um botão que marcava a mensagem como respondida, e
 * pronto. Quem abrisse o painel depois não conseguia distinguir "respondi pelo
 * meu e-mail" de "cliquei sem responder" — um carimbo afirmando um ato que o
 * sistema nunca executou (§1.5).
 *
 * ── Por que a trava é esta, e não um teste de tela ──────────────────────────
 *
 * O jeito de isso voltar não é alguém apagar a Edge Function: é alguém
 * acrescentar de novo um caminho curto — `marcar(id, 'answered')` — porque é
 * uma linha e "faz a mesma coisa". Não faz: pula o e-mail, que é o ato inteiro.
 *
 * Então o que se trava é a REGRA: `answered` só pode chegar ao banco por quem
 * acabou de mandar o e-mail. No cliente, isso significa que ninguém escreve
 * esse status à mão.
 */
/**
 * Tira comentário antes de procurar.
 *
 * `[03/09]` A primeira versão desta trava reprovou o próprio arquivo que
 * EXPLICA a regra — o comentário do `useMensagensDeContato` diz "não existe
 * mais um `marcar(id, 'answered')`", e o grep pegou a explicação.
 *
 * É a terceira vez que este projeto tropeça nisso (a lista de blocos pendentes
 * e a trava de fontes foram as outras duas), e a saída é sempre a mesma:
 * procurar no arquivo SEM comentário é mais simples e mais difícil de errar do
 * que tentar reconhecer código por expressão regular.
 */
const semComentario = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('o status "respondida" não pode ser marcado à mão', () => {
  const ARQUIVOS = varrerFontes('src', { extensoes: /\.(js|jsx)$/ });

  it('nenhum componente ou hook marca `answered` direto', () => {
    // `marcar(x, 'answered')`, `status: 'answered'`, `'answered')` — a busca é
    // pelo VALOR, porque é ele que chega ao banco, e não pelo nome da função.
    const infratores = ARQUIVOS
      .filter((f) => !f.includes('__tests__'))
      .map((f) => ({ f, src: semComentario(readFileSync(f, 'utf8')) }))
      // A lista de FILTROS do painel cita 'answered' legitimamente: ela é a aba
      // "Respondidas", que só LÊ. O que não pode é ESCREVER o valor.
      .filter(({ src }) => /(marcar|status)\s*[(:]\s*[^)]*['"]answered['"]/.test(src)
                        || /['"]answered['"]\s*\)/.test(src))
      .map(({ f }) => f);

    expect(infratores, infratores.length === 0 ? '' : (
      `\n  ${infratores.length} arquivo(s) marcam "answered" direto:\n`
      + infratores.map((f) => `    ${f}`).join('\n')
      + '\n\n  Isso traz de volta o defeito de 02/09: o painel afirmando que\n'
      + '  alguem respondeu quando nenhum e-mail saiu. O caminho certo e\n'
      + '  `responderMensagemDeContato`, que passa pela Edge Function\n'
      + '  `responder-contato` — e la o e-mail sai ANTES do registro.\n'
    )).toEqual([]);
  });

  it('o serviço de resposta passa pela Edge Function, e não pela tabela', () => {
    const src = readFileSync('src/services/contatoService.js', 'utf8');
    // Prova que leu de verdade: sem isto, renomear o arquivo deixaria a trava
    // verde para sempre.
    expect(src.length, 'contatoService.js veio vazio').toBeGreaterThan(500);

    const trecho = src.slice(src.indexOf('export async function responderMensagemDeContato'),
                             src.indexOf('export async function listarMensagensDeContato'));
    expect(trecho.length, 'nao achei a funcao de responder no service').toBeGreaterThan(50);
    expect(trecho,
      'responderMensagemDeContato parou de chamar a Edge Function. Se ela passar\n'
      + '  a escrever na tabela direto, o e-mail deixa de sair e o status volta a\n'
      + '  ser um carimbo vazio.')
      .toContain("functions.invoke('responder-contato'");
  });

  it('a tela mostra o TEXTO da resposta, e não só o carimbo', () => {
    const src = readFileSync('src/components/admin/CartaoDeContato.jsx', 'utf8');
    expect(src.length, 'CartaoDeContato.jsx veio vazio').toBeGreaterThan(500);
    // Sem isto o painel voltaria a dizer "respondida" sem dizer o quê — que é
    // metade do problema original: nao da para conferir o que foi dito.
    expect(src,
      'o cartao parou de exibir `reply_text`. O historico volta a ser um carimbo.')
      .toContain('reply_text');
  });
});
