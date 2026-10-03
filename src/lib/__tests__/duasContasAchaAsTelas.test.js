import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[02/10]` O roteiro de COMUM × MODERADOR precisa achar as telas.
 *
 * ── O silêncio que ela fecha ─────────────────────────────────────────────
 *
 * `e2e/duasContas.mjs` percorre quatro telas diferentes com nove seletores.
 * Renomear qualquer um deles não quebra teste nenhum de `src/` — a tela
 * continua certa para quem usa. O que acontece é o roteiro começar a morrer no
 * CI com
 *
 *     TimeoutError: waiting for locator("...")
 *
 * que é a mensagem muda de que o `publicarPost.mjs` reclama no cabeçalho dele.
 * Quem for investigar procura o bug no roteiro, e o conserto é uma linha noutro
 * arquivo.
 *
 * **E aqui é pior do que no roteiro do perfil**, porque este escreve em
 * produção com duas contas: morrer no meio deixa um post OCULTADO e uma
 * denúncia na fila para alguém limpar à mão.
 *
 * ── O que ela NÃO prova ──────────────────────────────────────────────────
 *
 * Que o fluxo funciona — isso é o E2E, num navegador, e exige as duas contas
 * descartáveis que só o CI tem. Esta trava responde uma pergunta só: **os
 * alvos que o roteiro procura existem nas telas?**
 *
 * ── Provada reinjetando o bug (§2) ───────────────────────────────────────
 *
 * Ver o relatório da sessão.
 */

/** O que o roteiro procura, e onde a tela tem de oferecer. */
const ALVOS = [
  { o_que: 'denunciar post',        marca: 'aria-label="Denunciar post"',   onde: 'src/components/feed/PostCard.jsx' },
  { o_que: 'deletar post',          marca: 'aria-label="Deletar post"',     onde: 'src/components/feed/PostCard.jsx' },
  { o_que: 'ação de moderação',     marca: 'aria-label="Ação de moderação"', onde: 'src/components/moderation/QueueItemCard.jsx' },
  { o_que: 'a opção de ocultar',    marca: 'value="hide"',                  onde: 'src/components/moderation/QueueItemCard.jsx' },
  { o_que: 'confirmar ocultação',   marca: 'Confirmar ocultação',           onde: 'src/components/moderation/QueueItemCard.jsx' },
  { o_que: 'o selo de oculto',      marca: 'Oculto',                        onde: 'src/components/admin/PostsPanel.jsx' },
  { o_que: 'mostrar post',          marca: 'title="Mostrar post',           onde: 'src/components/admin/PostsPanel.jsx' },
  { o_que: 'o painel do sino',      marca: 'notif-panel',                   onde: 'src/components/layout/Header.jsx' },
  { o_que: 'marcar tudo lido',      marca: 'Marcar tudo lido',              onde: 'src/components/layout/Header.jsx' },
  // `[02/10]` O chat da live, usado por `e2e/chatDaLive.mjs`. Mesma familia de
  // silencio: renomear o id derruba o roteiro com um timeout mudo.
  { o_que: 'o campo do chat',       marca: 'id="live-chat-input"',          onde: 'src/components/lives/ChatPanel.jsx' },
  { o_que: 'enviar no chat',        marca: 'aria-label="Enviar mensagem"',  onde: 'src/components/lives/ChatPanel.jsx' },
];

const ROTEIRO = 'e2e/duasContas.mjs';
const CHAT = 'e2e/chatDaLive.mjs';

describe('o roteiro de comum × moderador acha as telas', () => {
  const roteiro = readFileSync(ROTEIRO, 'utf8');

  it('o roteiro existe e não ficou vazio', () => {
    expect(roteiro.length, `${ROTEIRO} veio vazio — o caminho mudou?`).toBeGreaterThan(2000);
    expect(ALVOS.length, 'a lista de alvos ficou vazia').toBeGreaterThan(0);
  });

  for (const { o_que, marca, onde } of ALVOS) {
    it(`a tela oferece: ${o_que}`, () => {
      const fonte = readFileSync(onde, 'utf8');
      expect(fonte.length, `${onde} veio vazio`).toBeGreaterThan(200);
      expect(
        fonte.includes(marca),
        `\`${ROTEIRO}\` precisa de "${o_que}"\n`
        + `    pela marca  ${marca}\n`
        + `    e ela nao existe em ${onde}.\n`
        + '\n'
        + '    Se a tela mudou de proposito, ajuste a MARCA aqui E o seletor no\n'
        + '    roteiro — os dois juntos. Sem isso ele morre no CI com um\n'
        + '    `waiting for locator` mudo, DEPOIS de ja ter ocultado um post e\n'
        + '    aberto uma denuncia que alguem vai precisar limpar a mao.',
      ).toBe(true);
    });
  }

  it('o roteiro do chat da live existe e é CHAMADO', () => {
    // Roteiro que ninguem chama e cobertura que nao cobre: o arquivo fica no
    // repositorio, o `npm test` passa, e nenhum navegador nunca o executa.
    expect(readFileSync(CHAT, 'utf8').length, `${CHAT} veio vazio`).toBeGreaterThan(1000);
    expect(
      /percorrerChatDaLive\(/.test(readFileSync('e2e/lives.mjs', 'utf8')),
      '`e2e/lives.mjs` parou de chamar `percorrerChatDaLive`.\n'
      + '    O roteiro continua no repositorio e deixa de rodar — cobertura que\n'
      + '    nao cobre, e o `npm test` nao tem como notar.\n'
      + '    Ele mora em `lives.mjs` porque a policy de INSERT de `live_chat`\n'
      + '    exige a live NO AR, e so aquele roteiro poe uma no ar.',
    ).toBe(true);
  });

  it('o roteiro guarda o que precisa ser DESFEITO', () => {
    // Ele escreve em producao com duas contas. Se morrer no meio, a unica
    // coisa que separa "o CI reprovou" de "ficou lixo invisivel em producao" e
    // a lista que ele imprime ao falhar.
    expect(
      /aDesfazer\.push\(/.test(roteiro) && /SOBROU EM PRODUCAO/.test(roteiro),
      'o roteiro parou de registrar o que ficou pendente ao falhar.\n'
      + '    Ele oculta um post e abre uma denuncia; morrer no meio sem dizer o\n'
      + '    que sobrou e deixar lixo que so aparece quando alguem esbarra.',
    ).toBe(true);
  });
});
