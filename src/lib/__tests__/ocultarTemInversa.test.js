import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[02/10]` OCULTAR tem inversa, e ela é ALCANÇÁVEL pela tela.
 *
 * ── O buraco que isto fecha, medido no código em 02/10 ───────────────────
 *
 * `restoreContent` existia em `moderationService.js` desde sempre e **nenhum
 * botão chegava nele**:
 *
 *   - a fila de moderação busca `fetchModerationQueue('pending', …)` com o
 *     status FIXO — item resolvido some da tela, e com ele o "Restaurar";
 *   - o `handleRestorePost` do painel desfaz **apagar** (`deleted_at`), nunca
 *     **ocultar** (`hidden_at`) — o botão dele só aparece para apagados;
 *   - o painel do fundador não menciona `hidden_at`.
 *
 * Confirmada a ocultação, o conserto virava `UPDATE` no banco — o oposto de
 * ter painel. É a classe do `apply_suspension` sem `lift_suspension`
 * (`BANCO.md`, "toda ação de estado precisa da INVERSA e de quem a execute").
 *
 * Medido quando foi encontrado: **0 posts ocultos vivos**. Lacuna latente, e o
 * estrago apareceria na primeira ocultação por engano.
 *
 * ── As TRÊS formas de isto voltar a quebrar, e a 3ª é a silenciosa ───────
 *
 * **(1)** A ação some do hook — aí não há o que chamar.
 *
 * **(2)** O botão some da tela, ou deixa de olhar `hidden_at` — a ação existe
 * e ninguém a alcança, que é exatamente o estado de antes.
 *
 * **(3)** A prop deixa de ser passada do `AdminTabContent` para o
 * `PostsPanel`. Esta é a pior: o botão usa `handleMostrarPost?.(p.id)`, então
 * sem a prop **o clique não faz nada e nada estoura**. O admin clica, o modal
 * não abre, e não há erro em lugar nenhum (§1.5).
 *
 * ── Por que ela lê o código e não renderiza ──────────────────────────────
 *
 * A pergunta é de LIGAÇÃO entre três arquivos, não de comportamento de um
 * componente. Renderizar o painel exigiria montar o `ConfirmModal`, o
 * `useAuth` e a lista de posts — muito aparato para responder "o fio está
 * ligado?".
 *
 * ── Provada reinjetando o bug (§2) ───────────────────────────────────────
 *
 * Três reinjeções, uma por checagem — ver o relatório da sessão.
 */

const HOOK   = 'src/hooks/useAdminContentActions.js';
const PAINEL = 'src/components/admin/PostsPanel.jsx';
const LIGA   = 'src/components/admin/AdminTabContent.jsx';

const ler = (p) => {
  const t = readFileSync(p, 'utf8');
  if (t.length < 200) throw new Error(`${p} veio vazio — o caminho mudou?`);
  return t;
};

describe('ocultar tem inversa alcançável pela tela', () => {
  it('a ação existe e usa `restoreContent`, não `restore_post`', () => {
    const hook = ler(HOOK);
    expect(
      /function handleMostrarPost\s*\(/.test(hook),
      'o `handleMostrarPost` sumiu de useAdminContentActions.js.\n'
      + '    Sem ele, ocultar volta a ser acao sem caminho de volta pela tela —\n'
      + '    `restoreContent` existe no service e nenhum botao chega nele.',
    ).toBe(true);

    const corpo = hook.slice(hook.indexOf('function handleMostrarPost'));
    expect(
      /restoreContent\(\s*'post'/.test(corpo.slice(0, 1200)),
      '`handleMostrarPost` nao chama `restoreContent`.\n'
      + '    A RPC `restore_post` NAO serve: ela mexe em `deleted_at`, que e\n'
      + '    outro estado. Ocultar e apagar sao acoes diferentes e precisam de\n'
      + '    inversas diferentes — juntar as duas faria "mostrar" ressuscitar\n'
      + '    post apagado sem ninguem pedir.',
    ).toBe(true);
  });

  it('o botão existe e só aparece para post OCULTO', () => {
    const painel = ler(PAINEL);
    const i = painel.indexOf('handleMostrarPost?.(');
    expect(
      i,
      'o botao de mostrar sumiu do PostsPanel.\n'
      + '    A acao existe no hook e ninguem a alcanca — o estado exato de\n'
      + '    antes da correcao.',
    ).toBeGreaterThan(-1);

    // Olha para TRAS a partir do botao, e nao para frente a partir de
    // `p.hidden_at`. A 1a versao desta trava fazia o contrario e **passou numa
    // reinjecao**: o selo "Oculto", 20 linhas acima, tambem abre com
    // `{p.hidden_at && (`, entao o regex casava com ELE e achava o botao
    // dentro da janela. Defeito meu, encontrado pela propria reinjecao.
    const antes = painel.slice(Math.max(0, i - 250), i);
    expect(
      /\{p\.hidden_at && \(/.test(antes),
      'o botao de mostrar deixou de ser condicionado a `p.hidden_at`.\n'
      + '    Em post normal ele nao quer dizer nada, e oferecer "mostrar" para\n'
      + '    quem ja esta visivel e tela que mente sobre o estado.',
    ).toBe(true);
  });

  it('a prop É PASSADA — senão o clique não faz nada e nada estoura', () => {
    expect(
      /handleMostrarPost=\{actions\.handleMostrarPost\}/.test(ler(LIGA)),
      'o `AdminTabContent` parou de passar `handleMostrarPost` ao PostsPanel.\n'
      + '\n'
      + '    ESTA e a falha silenciosa: o botao chama `handleMostrarPost?.(p.id)`,\n'
      + '    e com a prop faltando o `?.` transforma o clique em NADA. O modal\n'
      + '    nao abre, nenhum erro aparece, nenhum log e gravado — e o admin\n'
      + '    conclui que o site travou.\n'
      + '\n'
      + '    O `?.` fica de proposito (ele protege o render); quem garante a\n'
      + '    ligacao e esta trava.',
    ).toBe(true);
  });
});
