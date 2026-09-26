import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[26/09]` Publicar virou ROTA — e rota sem porta é feature invisível.
 *
 * ── O que muda, e o risco que ele cria ────────────────────────────────────
 *
 * Decisão dele: *"se fosse só um modal, ia continuar pequeno na minha
 * opinião"*. O compositor saiu do topo do feed e virou `/publicar`.
 *
 * O risco novo é exatamente o oposto do antigo. Antes o compositor estava na
 * cara de quem abria o site — não tinha como sumir sem alguém notar. Agora ele
 * mora num endereço, e **a única coisa que o liga ao resto do site são dois
 * botões**. Se os dois saírem num refactor, a rota continua respondendo, o
 * build passa, nenhum teste de rota quebra — e **ninguém consegue publicar**.
 *
 * Silêncio de manual (§1.5): nada estoura, e a funcionalidade mais usada do
 * site simplesmente deixa de ter entrada.
 */

const HOME = readFileSync('src/pages/Home.jsx', 'utf8');
const LINHA = readFileSync('src/components/feed/LinhaDePublicar.jsx', 'utf8');
const SIDEBAR = readFileSync('src/components/layout/Sidebar.jsx', 'utf8');
const APP = readFileSync('src/App.jsx', 'utf8');
const FORM = readFileSync('src/components/feed/PostForm.jsx', 'utf8');
const CARD = readFileSync('src/components/feed/PostCard.jsx', 'utf8');
const BARRA = readFileSync('src/components/feed/composer/ComposerToolbar.jsx', 'utf8');
const EDITOR_ARTIGO = readFileSync('src/components/news/EditorDeArtigo.jsx', 'utf8');

describe('a rota de publicar tem porta', () => {
  it('a rota existe e está atrás de login', () => {
    expect(APP).toMatch(/path="\/publicar"/);
    // Publicar sem conta não existe — e a RLS recusaria de qualquer forma. O
    // que o `RequireAuth` evita é a tela pedindo o texto e o banco negando
    // depois, que é mensagem de erro no lugar de porta fechada.
    const rota = APP.match(/<Route path="\/publicar"[^\n]*/)?.[0] ?? '';
    expect(rota, 'a rota /publicar ficou sem RequireAuth').toMatch(/RequireAuth/);
  });

  it('o FEED tem a linha que leva até ela', () => {
    // O JSX MONTADO, e nao a linha de `import`: apagar so o `<LinhaDePublicar />`
    // e deixar o import faria a trava passar sobre um feed sem porta nenhuma.
    // Era o que acontecia — descoberto reinjetando.
    expect(HOME, 'o topo do feed perdeu a `LinhaDePublicar`.\n'
      + '  Sem ela quem abre o site nao tem como publicar pelo feed — e o\n'
      + '  compositor nao esta mais ali para suprir.').toMatch(/<LinhaDePublicar\s*\/>/);
    expect(LINHA).toMatch(/navigate\('\/publicar'\)/);
  });

  it('a BARRA tem o botão, e ele existe fora do feed', () => {
    // O botao na barra nao e redundante com a linha: a linha so aparece no
    // feed. De dentro de `/news`, `/lives` ou do perfil, ele e o unico
    // caminho — foi o pedido dele, "um botao + visivel em algum lugar".
    expect(SIDEBAR, 'a barra lateral perdeu o botao de publicar. Fora do feed '
      + 'nao sobra caminho nenhum para a rota.').toMatch(/navigate\('\/publicar'\)/);
  });

  it('a linha some para quem NÃO pode publicar', () => {
    // Oferecer o caminho a quem o banco vai recusar e a mesma falha do botao
    // "Publicar" aparecendo para admin no painel editorial: a tela promete um
    // poder que nao existe.
    expect(LINHA).toMatch(/if\s*\(!user\)\s*return null/);
    expect(LINHA, 'a linha voltou a aparecer para conta suspensa')
      .toMatch(/suspendedUntil/);
  });

  it('a linha carrega o gancho que os roteiros de navegador usam', () => {
    // Sem ele, `fluxos.mjs` e `painel-admin.mjs` perdem o sinal de
    // "sessao valida + perfil carregado + conta liberada".
    expect(LINHA).toMatch(/data-publicar="linha"/);
  });
});

describe('escrever e editar usam o MESMO editor', () => {
  it('o compositor usa o `EditorDeTexto`', () => {
    expect(FORM).toMatch(/EditorDeTexto/);
  });

  it('EDITAR um post usa o `EditorDeTexto`, e não um textarea cru', () => {
    // Era um `<textarea>`: quem escrevia **negrito** ao publicar e depois
    // clicava em editar via os asteriscos, sem barra de ferramentas e sem
    // previa — como se a formatacao tivesse sumido.
    // O recorte e o bloco `{editing ? ... }` ate o contador de tempo — e nao
    // o arquivo inteiro. Procurar `EditorDeTexto` no arquivo todo passa com a
    // linha de `import` sozinha, sobre uma edicao que voltou a ser textarea:
    // descoberto reinjetando, e por isso as DUAS pontas sao conferidas aqui.
    // O recorte comeca no `{editing ?` e vai ate o contador de tempo. O
    // `EditCountdown` e procurado A PARTIR dali: procurado do inicio do
    // arquivo, ele casa com a linha de `import` no topo e o recorte sai
    // VAZIO — a trava passaria conferindo string nenhuma. Foi o que aconteceu,
    // e quem pegou foi a guarda de tamanho logo abaixo.
    const inicio = CARD.indexOf('{editing ?');
    // A PROSA sai antes da conferencia. O comentario que explica a troca cita
    // `<textarea>` por escrito, e sem isto a trava reprovaria a si mesma —
    // aconteceu. Mesma disciplina do `categoriaSaiuDaExperiencia.test.js`:
    // ignorar prosa que cita o que a regra proibe.
    const semProsa = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const blocoDeEdicao = semProsa(CARD.slice(inicio, CARD.indexOf('EditCountdown', inicio)));
    expect(blocoDeEdicao.length, 'nao achei o bloco de edicao do PostCard — o '
      + 'formato mudou? Sem isto a trava confere uma string vazia.')
      .toBeGreaterThan(200);

    expect(blocoDeEdicao, 'a edicao de post voltou a ser um textarea cru.\n'
      + '  Duas caixas para o mesmo texto divergem na primeira feature nova\n'
      + '  (§4, fonte unica), e a previa e o que diz que o marcador vira algo.')
      .toMatch(/<EditorDeTexto/);
    expect(blocoDeEdicao, 'sobrou um <textarea> no bloco de edicao do post')
      .not.toMatch(/<textarea/);
  });
});

describe('o botao que NAVEGA nao se chama igual ao que ENVIA', () => {
  /**
   * O CI reprovou por isto em 26/09, e o problema NAO era o teste.
   *
   * O botao da barra lateral se chamava "Publicar", igual ao que envia o post
   * no compositor. Em `/publicar` os dois ficavam na mesma tela:
   *
   *   strict mode violation: getByRole('button', { name: /^Publicar$/ })
   *     resolved to 2 elements
   *
   * Sao DOIS estragos, e o segundo e o grave:
   *
   *   ACESSIBILIDADE  quem usa leitor de tela ouve "Publicar" duas vezes, com
   *                   significados diferentes — um navega, o outro envia
   *   SEGURANCA       o `painel-admin.mjs` confere que um `admin` NUNCA ve um
   *                   botao "Publicar" — e assim que o corte editorial do News
   *                   e verificado. Um botao fixo com esse nome na barra
   *                   tornaria aquela checagem inutil, e ela imprimiria verde
   *                   sobre nada
   */
  const ENVIAR = 'Publicar';

  it('o compositor continua usando o verbo ENVIAR', () => {
    // Se o rotulo do compositor mudar, a colisao volta pelo outro lado: alguem
    // renomeia este para "Criar post" e a barra passa a ser a ambigua.
    expect(BARRA, `o botao de enviar do compositor deixou de se chamar "${ENVIAR}". `
      + 'Se mudou de proposito, ajuste o `painel-admin.mjs` junto: e por esse '
      + 'nome que ele confere o corte editorial do News.')
      .toMatch(new RegExp(`'${ENVIAR}'`));
  });

  it('nenhum botao de NAVEGAR usa esse mesmo nome', () => {
    const navegadores = [
      ['a barra lateral', SIDEBAR],
      ['a linha do topo do feed', LINHA],
    ];
    const colidem = navegadores
      .filter(([, fonte]) => new RegExp(`(>|aria-label=")\\s*${ENVIAR}\\s*(<|")`).test(fonte))
      .map(([nome]) => nome);

    expect(colidem, `estes botoes NAVEGAM e se chamam "${ENVIAR}", igual ao que ENVIA:\n`
      + `  ${colidem.join(', ')}\n\n`
      + '  Em /publicar os dois ficam na mesma tela: o leitor de tela anuncia o\n'
      + '  mesmo nome para acoes diferentes, e o `painel-admin.mjs` perde a\n'
      + '  checagem do corte editorial do News, que procura exatamente por esse\n'
      + '  nome. Use um verbo de NAVEGACAO ("Criar post").')
      .toEqual([]);
  });
});

describe('mudar de estado SALVA o que esta na tela antes', () => {
  /**
   * O dono digitou o corpo da materia, clicou em Publicar, e levou
   * `violates check constraint "news_articles_corpo_exigido_no_ar"`.
   *
   * A regra do banco estava certa. A TELA e que mentia: `mudarEstado` manda
   * so `{status, publicado_em}`, e o texto que ele acabara de escrever nunca
   * tinha ido ao banco. Os dois botoes ficavam lado a lado sem dizer que um
   * nao enxergava o outro.
   */
  it('`paraEstado` chama `salvarArtigo` quando ha rascunho pendente', () => {
    const fn = EDITOR_ARTIGO.slice(
      EDITOR_ARTIGO.indexOf('async function paraEstado'),
      EDITOR_ARTIGO.indexOf('return (', EDITOR_ARTIGO.indexOf('async function paraEstado')),
    );
    expect(fn.length, 'nao achei o `async function paraEstado` no EditorDeArtigo.\n'
      + '  Ou ele voltou a ser o arrow de uma linha — que e exatamente a\n'
      + '  regressao que esta trava existe para pegar: publicar mandaria so o\n'
      + '  `status` e o corpo recem-digitado ficaria de fora —, ou o formato\n'
      + '  mudou e a trava precisa acompanhar. Nos dois casos, olhe.')
      .toBeGreaterThan(150);

    expect(fn, 'mudar de estado voltou a NAO salvar o que esta na tela.\n'
      + '  Publicar mandaria so o `status`, e o corpo recem-digitado ficaria de\n'
      + '  fora: o CHECK do banco recusa, e a pessoa le um erro de constraint\n'
      + '  sobre um campo que ela VE preenchido na frente dela.')
      .toMatch(/rascunho !== null[\s\S]*salvarArtigo\(/);
  });

  it('se o salvamento falhar, ele NAO segue para a mudanca de estado', () => {
    // Seguir publicaria a versao velha e diria que deu certo — pior do que o
    // erro original, porque some em silencio (§1.5).
    const fn = EDITOR_ARTIGO.slice(
      EDITOR_ARTIGO.indexOf('async function paraEstado'),
      EDITOR_ARTIGO.indexOf('await comAviso(mudarEstado'),
    );
    expect(fn, 'o caminho de erro do salvamento deixou de interromper').toMatch(/if \(error\)[\s\S]*return;/);
  });
});
