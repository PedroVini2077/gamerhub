import { describe, it, expect } from 'vitest';
import { safeExternalUrl, isSafeExternalUrl } from '../url';
import { getEmbedInfo } from '../embed';

// Regressão de uma falha REAL encontrada na auditoria de ago/2026:
// `getEmbedInfo` devolvia `{type:'link'}` para qualquer string, então
// `javascript:...` passava pela validação do PostForm e virava `<a href>` no
// EmbedPlayer. Clicar no link de um post executava script na origem do site,
// com o token de sessão do Supabase acessível no localStorage.

const PERIGOSAS = [
  'javascript:alert(document.cookie)',
  'JaVaScRiPt:alert(1)',            // caixa alternada
  '  javascript:alert(1)  ',         // espaços em volta
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox("x")',
  'file:///etc/passwd',
  'blob:https://site.com/uuid',
  'about:blank',
];

const SEGURAS = [
  'https://youtube.com/watch?v=dQw4w9WgXcQ',
  'http://exemplo.com/promo',
  'https://store.steampowered.com/app/1/',
];

describe('safeExternalUrl', () => {
  it('rejeita todo protocolo que não seja http(s)', () => {
    for (const u of PERIGOSAS) {
      expect(safeExternalUrl(u), u).toBeNull();
      expect(isSafeExternalUrl(u), u).toBe(false);
    }
  });

  it('aceita http e https', () => {
    for (const u of SEGURAS) {
      expect(safeExternalUrl(u), u).toBe(u);
      expect(isSafeExternalUrl(u), u).toBe(true);
    }
  });

  it('rejeita entrada vazia, não-string e string que não é URL', () => {
    for (const u of ['', '   ', null, undefined, 42, {}, [], 'nao-e-url', 'youtube.com/sem-protocolo']) {
      expect(safeExternalUrl(u)).toBeNull();
    }
  });
});

describe('getEmbedInfo — precisa devolver null para link inseguro', () => {
  it('rejeita URLs perigosas (antes caíam em type:link e viravam href)', () => {
    for (const u of PERIGOSAS) {
      expect(getEmbedInfo(u), u).toBeNull();
    }
  });

  it('rejeita vazio e string sem protocolo', () => {
    expect(getEmbedInfo('')).toBeNull();
    expect(getEmbedInfo(null)).toBeNull();
    expect(getEmbedInfo('nao-e-url-nenhuma')).toBeNull();
  });

  it('continua reconhecendo os provedores suportados', () => {
    expect(getEmbedInfo('https://youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ type: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(getEmbedInfo('https://twitch.tv/algumcanal')).toMatchObject({ type: 'twitch' });
    expect(getEmbedInfo('https://www.tiktok.com/@user/video/123456')).toMatchObject({ type: 'tiktok' });
  });

  it('link http(s) genérico continua sendo tratado como link externo', () => {
    expect(getEmbedInfo('https://exemplo.com/artigo')).toMatchObject({ type: 'link' });
  });
});
