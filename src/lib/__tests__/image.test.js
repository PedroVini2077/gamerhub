import { describe, it, expect } from 'vitest';
import { compressImage, compressMedias } from '../image';

// Os casos abaixo são os que saem ANTES de tocar em canvas/DOM — justamente os
// que garantem o contrato "otimização nunca quebra o upload". O caminho que
// rasteriza de fato depende de canvas e é validado no browser.

const file = (name, type) => new File(['x'], name, { type });

describe('compressImage — casos que devolvem o original', () => {
  it('não quebra com entrada vazia', async () => {
    await expect(compressImage(null)).resolves.toBe(null);
    await expect(compressImage(undefined)).resolves.toBe(undefined);
  });

  it('devolve não-imagem intacta', async () => {
    const video = file('clipe.mp4', 'video/mp4');
    expect(await compressImage(video)).toBe(video);

    const audio = file('musica.mp3', 'audio/mpeg');
    expect(await compressImage(audio)).toBe(audio);
  });

  it('não passa GIF pelo canvas (mataria a animação)', async () => {
    const gif = file('meme.gif', 'image/gif');
    expect(await compressImage(gif)).toBe(gif);
  });

  it('não rasteriza SVG', async () => {
    const svg = file('icone.svg', 'image/svg+xml');
    expect(await compressImage(svg)).toBe(svg);
  });
});

describe('compressMedias', () => {
  it('devolve lista vazia sem entrada', async () => {
    expect(await compressMedias()).toEqual([]);
    expect(await compressMedias(null)).toEqual([]);
  });

  it('preserva itens que não são imagem, mantendo a ordem', async () => {
    const medias = [
      { file: file('a.mp4', 'video/mp4'), type: 'video' },
      { file: file('b.gif', 'image/gif'), type: 'image' },
      { file: file('c.mp3', 'audio/mpeg'), type: 'audio' },
    ];
    const out = await compressMedias(medias);

    expect(out).toHaveLength(3);
    expect(out[0]).toBe(medias[0]);          // vídeo passa sem tocar
    expect(out[2]).toBe(medias[2]);          // áudio idem
    expect(out[1].type).toBe('image');       // gif segue imagem…
    expect(out[1].file).toBe(medias[1].file); // …com o arquivo original
  });

  it('tolera item malformado sem derrubar o lote', async () => {
    const ok = { file: file('a.mp4', 'video/mp4'), type: 'video' };
    const out = await compressMedias([{ type: 'image' }, ok, null]);
    expect(out).toHaveLength(3);
    expect(out[1]).toBe(ok);
  });
});
