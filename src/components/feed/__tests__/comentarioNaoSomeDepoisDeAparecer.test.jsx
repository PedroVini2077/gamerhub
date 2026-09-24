/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * `[24/09]` O comentário aparecia e SUMIA — resposta velha sobrescrevendo a nova.
 *
 * ── Como isto foi encontrado, e por que ninguém tinha visto ────────────────
 *
 * Saiu de um E2E que eu estava escrevendo para OUTRA coisa (responder). O
 * roteiro comentava, via o comentário na tela, e no instante seguinte o card
 * mostrava o botão "Comentar" — rótulo que só existe quando a contagem é ZERO
 * — e a lista vazia. O comentário estava vivo no banco, `hidden_at` nulo.
 *
 * Ninguém tinha visto porque **nada olhava duas vezes**. O roteiro antigo
 * conferia o comentário e ia embora apagar o post; a pessoa que comenta olha
 * uma vez e rola a página. O sintoma só aparece para quem volta a olhar.
 *
 * ── O mecanismo, que é a 3ª armadilha da FASE 1 do §6 ──────────────────────
 *
 * Duas buscas de comentário disputam o mesmo `setComments`:
 *
 *   1. abrir a seção dispara `fetchCommentList()`   -> busca A, devolve []
 *   2. enviar o comentário dispara `fetchCommentList()` -> busca B, devolve [c]
 *
 * Se B responde primeiro e A depois — o que acontece quando a primeira
 * requisição pega uma conexão lenta —, a resposta VELHA chega por último e
 * apaga a nova. É exatamente *"resposta velha sobrescrevendo a nova"*, que o
 * `CLAUDE.md` lista na FASE 1 da auditoria e que nunca tinha sido testado.
 *
 * ── Por que ele é grave apesar de parecer cosmético ────────────────────────
 *
 * Do lado de quem usa: você comenta, vê seu comentário, e ele some. Não há
 * erro, não há log, e o banco está certo — então a pessoa comenta de novo.
 * É o §1.5 com as três respostas em "nada".
 *
 * ── Provado reinjetando (§2) ──────────────────────────────────────────────
 *
 * Com o guard removido de `CommentSection.jsx`, este teste falha dizendo que
 * o comentário sumiu da tela. Foi assim que ele nasceu: escrito ANTES do
 * conserto, vermelho, e verde depois.
 */

const comentarios = { fetchComments: vi.fn(), fetchCommentCount: vi.fn(), addComment: vi.fn() };

vi.mock('../../../services/commentService', () => ({
  fetchComments: (...a) => comentarios.fetchComments(...a),
  fetchCommentCount: (...a) => comentarios.fetchCommentCount(...a),
  addComment: (...a) => comentarios.addComment(...a),
}));
vi.mock('../../../hooks/useAuth.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: { id: 'u1', username: 'teste' } }),
}));
vi.mock('../../../hooks/useBlockedWords', () => ({
  useBlockedWords: () => ({ checkContent: () => ({ blocked: false }) }),
}));
vi.mock('../../../services/moderationAiService', () => ({ moderateText: vi.fn() }));
vi.mock('../../../lib/auditLog', () => ({ logAudit: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

// O CommentCard de verdade traz avatar, curtida, papel e modais — nada disso
// participa da corrida. O dublê mostra só o conteúdo, que é o que se mede.
vi.mock('../CommentCard', () => ({
  default: ({ comment }) => <p>{comment.content}</p>,
}));
vi.mock('../../ui/SuspendedNotice', () => ({ default: () => null }));

const { default: CommentSection } = await import('../CommentSection');

afterEach(() => { cleanup(); vi.clearAllMocks(); });

/** Promessa que este teste resolve na hora que quiser. */
function promessaControlada() {
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });
  return { promessa, resolver };
}

describe('o comentário não some depois de aparecer', () => {
  it('a busca VELHA que chega atrasada não apaga o comentário recém-criado', async () => {
    const buscaAoAbrir = promessaControlada();   // A — dispara ao abrir, devolve []
    const buscaAposEnviar = promessaControlada(); // B — dispara ao enviar, devolve [c]

    comentarios.fetchComments
      .mockReturnValueOnce(buscaAoAbrir.promessa)
      .mockReturnValueOnce(buscaAposEnviar.promessa);
    comentarios.addComment.mockResolvedValue({ data: { id: 'c1' }, error: null });

    render(<CommentSection postId="p1" initialCount={0} />);

    // 1. Abrir a seção dispara a busca A, que fica pendente.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Comentar$/ })); });
    expect(comentarios.fetchComments).toHaveBeenCalledTimes(1);

    // 2. Comentar dispara a busca B, e B responde PRIMEIRO.
    const campo = screen.getByLabelText(/Escreva um coment/i);
    fireEvent.change(campo, { target: { value: 'meu comentario' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enviar comentário' })); });

    await act(async () => {
      buscaAposEnviar.resolver({ data: [{ id: 'c1', content: 'meu comentario', parent_id: null }] });
    });
    expect(screen.queryByText('meu comentario')).not.toBeNull();

    // 3. A resposta VELHA chega atrasada, com a lista de antes do comentário.
    await act(async () => { buscaAoAbrir.resolver({ data: [] }); });

    expect(screen.queryByText('meu comentario'), [
      'O comentário apareceu e SUMIU da tela.',
      '',
      'A busca disparada ao ABRIR a seção respondeu depois da busca disparada',
      'ao ENVIAR, e a resposta velha (lista vazia) sobrescreveu a nova.',
      '',
      'Do lado de quem usa não há erro, não há log e o banco está certo — a',
      'pessoa só vê o próprio comentário desaparecer, e comenta de novo.',
      '',
      'O conserto é descartar resposta de requisição que já foi superada.',
      'Ver o contador de pedidos em `CommentSection.jsx`.',
    ].join('\n')).not.toBeNull();
  });
});
