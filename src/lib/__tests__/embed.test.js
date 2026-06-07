import { describe, it, expect } from 'vitest';
import { getEmbedInfo } from '../embed';

describe('getEmbedInfo', () => {
  it('retorna null sem URL', () => {
    expect(getEmbedInfo(null)).toBe(null);
    expect(getEmbedInfo('')).toBe(null);
  });

  it('detecta YouTube (watch e youtu.be)', () => {
    expect(getEmbedInfo('https://youtube.com/watch?v=abcdefghijk')).toMatchObject({ type: 'youtube', id: 'abcdefghijk' });
    expect(getEmbedInfo('https://youtu.be/abcdefghijk')).toMatchObject({ type: 'youtube', id: 'abcdefghijk' });
  });

  it('distingue Twitch canal, VOD e clip (ordem importa)', () => {
    expect(getEmbedInfo('https://twitch.tv/algumcanal')).toMatchObject({ type: 'twitch', id: 'algumcanal' });
    expect(getEmbedInfo('https://twitch.tv/videos/123456')).toMatchObject({ type: 'twitch-vod', id: '123456' });
    expect(getEmbedInfo('https://www.twitch.tv/foo/clip/NomeDoClip')).toMatchObject({ type: 'twitch-clip', id: 'NomeDoClip' });
  });

  it('detecta TikTok e Instagram', () => {
    expect(getEmbedInfo('https://tiktok.com/@user/video/12345')).toMatchObject({ type: 'tiktok', id: '12345' });
    expect(getEmbedInfo('https://instagram.com/p/abc123')).toMatchObject({ type: 'instagram', id: 'abc123' });
  });

  it('cai em link genérico quando não reconhece', () => {
    expect(getEmbedInfo('https://exemplo.com/qualquer-coisa')).toMatchObject({ type: 'link' });
  });
});
