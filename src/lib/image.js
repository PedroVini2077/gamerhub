// Compressão de imagem client-side.
//
// Motivo: egress (banda do CDN) é a cota mais apertada do plano Free. O tamanho
// do arquivo no bucket = bytes trafegados a CADA visualização, então cortar o
// arquivo na origem é o maior ganho por esforço que existe aqui. Uma foto de
// celular (3–5MB, 4000px) vira ~150–250KB em 1600px/WebP — 20× menos banda por
// view, sem diferença perceptível na tela.
//
// Usado por: upload de mídia de post, mídia do mural e avatar.

// WebP economiza ~30% sobre JPEG na mesma qualidade, mas nem todo navegador
// suporta ENCODAR (o canvas cai pra PNG silenciosamente, que fica gigante).
// Detecta uma vez e memoiza.
let webpSupport = null;
function supportsWebp() {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

// GIF animado perde a animação ao passar pelo canvas; SVG não é raster.
// Melhor devolver o original do que entregar algo quebrado.
const SKIP_TYPES = ['image/gif', 'image/svg+xml'];

function replaceExt(name, ext) {
  return `${name.replace(/\.[^/.]+$/, '') || 'image'}.${ext}`;
}

/**
 * Redimensiona e recomprime uma imagem no browser.
 *
 * @param {File} file            arquivo original escolhido pelo usuário
 * @param {object} [opts]
 * @param {number} [opts.maxSize] maior lado, em px (default 1600)
 * @param {number} [opts.quality] qualidade 0–1 (default 0.82)
 * @param {number} [opts.skipUnder] não mexe em arquivos menores que isso, em
 *                                  bytes, se as dimensões já couberem
 * @returns {Promise<File>} arquivo comprimido — ou o próprio original se não
 *                          der pra comprimir (nunca rejeita: upload não pode
 *                          quebrar por causa de otimização).
 */
export function compressImage(file, opts = {}) {
  const { maxSize = 1600, quality = 0.82, skipUnder = 120 * 1024 } = opts;

  if (!file || !file.type?.startsWith('image/') || SKIP_TYPES.includes(file.type)) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    // Qualquer falha (formato exótico, imagem corrompida, canvas bloqueado por
    // memória) devolve o original em vez de estourar o fluxo de upload.
    const done = (result) => { URL.revokeObjectURL(url); resolve(result || file); };

    img.onerror = () => done(null);
    img.onload = () => {
      const { width: iw, height: ih } = img;
      if (!iw || !ih) return done(null);

      const scale = Math.min(1, maxSize / Math.max(iw, ih));
      // Já é pequena o bastante em bytes E em dimensão: recomprimir só gastaria
      // CPU e poderia até aumentar o arquivo.
      if (scale === 1 && file.size <= skipUnder) return done(file);

      const w = Math.max(1, Math.round(iw * scale));
      const h = Math.max(1, Math.round(ih * scale));

      let canvas;
      try {
        canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(null);
        ctx.drawImage(img, 0, 0, w, h);
      } catch {
        return done(null);
      }

      const webp = supportsWebp();
      const mime = webp ? 'image/webp' : 'image/jpeg';
      const ext = webp ? 'webp' : 'jpg';

      canvas.toBlob((blob) => {
        // Sem blob, ou ficou MAIOR que o original (acontece com prints já
        // otimizados): fica com o original.
        if (!blob || blob.size >= file.size) return done(null);
        done(new File([blob], replaceExt(file.name, ext), { type: mime }));
      }, mime, quality);
    };

    img.src = url;
  });
}

/**
 * Comprime uma lista de mídias, deixando não-imagens (vídeo/áudio) intactas.
 * Falha em um item nunca derruba os outros.
 *
 * @param {Array<{file: File, type: string}>} medias
 * @param {object} [opts] repassado pro compressImage
 */
export async function compressMedias(medias, opts) {
  return Promise.all((medias || []).map(async (m) => {
    if (m?.type !== 'image' || !m.file) return m;
    try {
      return { ...m, file: await compressImage(m.file, opts) };
    } catch {
      return m;
    }
  }));
}
