/**
 * @vitest-environment jsdom
 *
 * Este arquivo existe por causa de uma lacuna admitida no PR do vazamento de
 * memória: na época o projeto não tinha jsdom nem @testing-library/react, então
 * o `lib/objectUrls.js` foi testado isolado e a LIGAÇÃO entre o hook e o
 * rastreador ficou validada só por leitura. É essa ligação que se testa aqui —
 * publicar um post e desmontar o formulário precisam revogar as prévias.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

vi.mock('../useAuth.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: { id: 'p1', username: 'tester' } }),
}));
vi.mock('../useBlockedWords', () => ({
  useBlockedWords: () => ({ checkContent: () => ({ blocked: false }) }),
}));
vi.mock('../../services/postService', () => ({
  createPost: vi.fn(async () => ({ data: { id: 'post1' }, error: null })),
  uploadAudio: vi.fn(async () => ({ data: 'audio-url', error: null })),
  uploadPostMediaFiles: vi.fn(async () => ({ data: { imageUrls: [], failed: 0 }, error: null })),
}));
// `[29/08]` O CAMINHO IMPORTA, e este mock já quebrou por causa disso.
//
// As chamadas de IA saíram de `moderationService` para `moderationAiService`
// quando o primeiro passou de 300 linhas. O mock continuou apontando para o
// arquivo antigo — ele não avisa que não interceptou nada, então o módulo real
// passou a ser carregado, e com ele o `lib/supabase.js`, que estoura sem as
// variáveis de ambiente. Aqui passou (tenho `.env` local) e o CI reprovou.
//
// Guarda embaixo: um teste confere que este caminho existe de verdade.
vi.mock('../../services/moderationAiService', () => ({
  moderateText: vi.fn(), moderateImages: vi.fn(), moderateVideos: vi.fn(), moderateLinks: vi.fn(),
}));
vi.mock('../../lib/embed', () => ({ getEmbedInfo: () => null }));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'toast-id') },
}));

const { usePostComposer } = await import('../usePostComposer');

let created;
let revoked;

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${n++}`;
    created.push(url);
    return url;
  });
  globalThis.URL.revokeObjectURL = vi.fn(url => revoked.push(url));
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const pngFile = name => new File(['conteudo'], name, { type: 'image/png' });
const changeEvent = file => ({ target: { files: [file], value: 'algo' } });

/** Anexa uma imagem passando pelo mesmo caminho que a UI usa. */
function attachImage(result, name) {
  act(() => {
    // handleMediaSelect mexe no input escondido; num teste de hook o ref está
    // vazio, então ligamos um input de verdade nele.
    result.current.fileRef.current = document.createElement('input');
    result.current.handleMediaSelect('image');
  });
  act(() => result.current.handleFileChange(changeEvent(pngFile(name))));
}

describe('usePostComposer — ciclo de vida das prévias', () => {
  it('anexar cria uma prévia rastreada', () => {
    const { result } = renderHook(() => usePostComposer());
    attachImage(result, 'a.png');

    expect(result.current.medias).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(revoked).toEqual([]);
  });

  it('remover a mídia revoga a prévia dela', () => {
    const { result } = renderHook(() => usePostComposer());
    attachImage(result, 'a.png');
    const url = created[0];

    act(() => result.current.removeMedia(0));

    expect(result.current.medias).toHaveLength(0);
    expect(revoked).toEqual([url]);
  });

  // O CAMINHO DO BUG: antes da correção, publicar fazia setMedias([]) e ia
  // embora, deixando todas as prévias vivas na memória do navegador.
  it('publicar revoga TODAS as prévias — o vazamento original', async () => {
    const { result } = renderHook(() => usePostComposer());
    attachImage(result, 'a.png');
    attachImage(result, 'b.png');
    attachImage(result, 'c.png');
    act(() => result.current.setTitle('Post de teste'));

    expect(created).toHaveLength(3);

    await act(async () => { await result.current.handleSubmit(); });

    expect(result.current.medias).toEqual([]);
    expect([...revoked].sort()).toEqual([...created].sort());
  });

  it('desmontar o formulário com anexos pendentes revoga tudo', () => {
    const { result, unmount } = renderHook(() => usePostComposer());
    attachImage(result, 'a.png');
    attachImage(result, 'b.png');
    expect(revoked).toEqual([]);

    unmount();

    expect([...revoked].sort()).toEqual([...created].sort());
  });

  it('publicar chama onPost e limpa o formulário', async () => {
    const onPost = vi.fn();
    const { result } = renderHook(() => usePostComposer(onPost));
    act(() => {
      result.current.setTitle('Titulo');
      result.current.setContent('Conteudo');
    });

    await act(async () => { await result.current.handleSubmit(); });

    expect(onPost).toHaveBeenCalledTimes(1);
    expect(result.current.title).toBe('');
    expect(result.current.content).toBe('');
  });

  it('não publica sem título — e não revoga nada por engano', async () => {
    const onPost = vi.fn();
    const { result } = renderHook(() => usePostComposer(onPost));
    attachImage(result, 'a.png');

    await act(async () => { await result.current.handleSubmit(); });

    expect(onPost).not.toHaveBeenCalled();
    expect(result.current.medias).toHaveLength(1);
    expect(revoked).toEqual([]);
  });
});

/**
 * Trava do MOCK, e não do código.
 *
 * `vi.mock` de um caminho que não existe mais é silencioso: nada falha, o
 * módulo real é carregado, e o teste passa a exercitar a coisa que ele
 * pretendia substituir. Aqui o efeito foi o `lib/supabase.js` estourar por
 * falta de variável de ambiente — só no CI, porque na máquina de quem escreveu
 * havia `.env`.
 *
 * Esta checagem transforma "o mock não intercepta nada" em falha imediata e
 * com nome, em vez de um erro de ambiente três passos adiante.
 */
describe('os mocks apontam para arquivos que existem', () => {
  it('o módulo de moderação por IA está onde o mock diz', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fonte = readFileSync(join(import.meta.dirname, '../usePostComposer.js'), 'utf8');
    expect(
      fonte,
      'O `usePostComposer` deixou de importar de `services/moderationAiService`.\n'
      + 'Se o arquivo mudou de lugar, o `vi.mock` no topo deste teste precisa ir\n'
      + 'junto — mock de caminho errado não avisa, ele só deixa o módulo real\n'
      + 'entrar, e aí o teste prova outra coisa.',
    ).toContain("from '../services/moderationAiService'");
  });
});
