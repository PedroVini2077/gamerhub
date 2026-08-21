import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUrlTracker } from '../objectUrls';

// jsdom não está instalado neste projeto, então o objeto URL global do Node não
// tem createObjectURL/revokeObjectURL. Stub simples que registra o que foi
// criado e revogado — é exatamente o que precisamos afirmar.
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

const fakeFile = name => ({ name });

describe('createUrlTracker', () => {
  it('rastreia cada URL criada', () => {
    const t = createUrlTracker();
    t.track(fakeFile('a.png'));
    t.track(fakeFile('b.png'));
    expect(t.size).toBe(2);
    expect(created).toHaveLength(2);
  });

  it('release revoga só a URL pedida', () => {
    const t = createUrlTracker();
    const a = t.track(fakeFile('a.png'));
    t.track(fakeFile('b.png'));
    t.release(a);
    expect(revoked).toEqual([a]);
    expect(t.size).toBe(1);
  });

  // Este é o teste do vazamento: ANTES da correção, publicar um post chamava
  // `setMedias([])` e ia embora, deixando todas as prévias vivas. releaseAll é
  // o que fecha esse caminho — e o `size` volta a zero.
  it('releaseAll revoga tudo que sobrou — o vazamento ao publicar', () => {
    const t = createUrlTracker();
    const urls = ['a.png', 'b.mp4', 'c.png'].map(n => t.track(fakeFile(n)));
    expect(t.size).toBe(3);

    t.releaseAll();

    expect(revoked.sort()).toEqual([...urls].sort());
    expect(t.size).toBe(0);
  });

  it('não revoga duas vezes a mesma URL', () => {
    const t = createUrlTracker();
    const a = t.track(fakeFile('a.png'));
    t.release(a);
    t.release(a);
    t.releaseAll();
    expect(revoked).toEqual([a]);
  });

  it('release ignora valor vazio', () => {
    const t = createUrlTracker();
    t.release(null);
    t.release(undefined);
    t.release('');
    expect(revoked).toEqual([]);
  });

  it('rastreadores diferentes não interferem entre si', () => {
    const a = createUrlTracker();
    const b = createUrlTracker();
    a.track(fakeFile('a.png'));
    const bUrl = b.track(fakeFile('b.png'));
    a.releaseAll();
    expect(revoked).toHaveLength(1);
    expect(revoked).not.toContain(bUrl);
    expect(b.size).toBe(1);
  });
});
