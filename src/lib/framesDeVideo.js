/**
 * Extrai alguns quadros de um vídeo, no navegador, para a moderação analisar.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * Vídeo era o único tipo de mídia que subia sem NENHUMA checagem. Em
 * `postService.js`, só `type === 'image'` entra na lista mandada para a IA —
 * texto, imagem e link eram moderados; vídeo passava direto.
 *
 * ── Por que quadros, e não o vídeo inteiro ──────────────────────────────────
 *
 * Não existe moderação de vídeo barata: as APIs que analisam vídeo cobram por
 * segundo. Já a moderação de IMAGEM o projeto tem e paga. Alguns quadros
 * herdam de graça toda a cobertura dela — nudez, gore, automutilação — por
 * custo de imagem, não de vídeo.
 *
 * ── O que isto NÃO garante, e é importante dizer ────────────────────────────
 *
 * Amostragem não é análise completa. Um vídeo com dois segundos de conteúdo
 * proibido entre os quadros amostrados passa. Isso é uma limitação real e
 * assumida — a alternativa é não checar nada, que é o que existia antes.
 *
 * O piso da IA para vídeo é o mesmo da imagem, e o caminho de ocultar
 * automaticamente também: quem decide é a Edge Function, não este arquivo.
 */

// Três quadros: começo, meio e fim. Cobre a abertura (onde costuma estar a
// isca), o miolo e o final, sem chegar perto do teto de 4 imagens por chamada
// que a Edge Function aplica.
export const QUANTIDADE_DE_QUADROS = 3;

// 512px de largura. A moderação da OpenAI não precisa de resolução alta para
// classificar conteúdo, e cada pixel a mais vira base64 trafegado — o teto de
// 400 KB por imagem embutida está do outro lado, na Edge Function.
const LARGURA_MAXIMA = 512;
const QUALIDADE_JPEG = 0.7;

// Vídeo corrompido, codec que o navegador não abre, ou arquivo que nunca
// carrega: sem teto, a promessa nunca resolve e a publicação fica pendurada
// para sempre. Enfeite que trava é ruim; moderação que trava é pior.
const TEMPO_MAXIMO_MS = 15000;

/**
 * @param {File|Blob} arquivo vídeo escolhido pelo usuário
 * @returns {Promise<string[]>} data URLs JPEG. Lista VAZIA quando não deu para
 *   extrair — quem chama precisa tratar isso como "não analisado", nunca como
 *   "analisado e limpo".
 */
export function extrairQuadros(arquivo, quantidade = QUANTIDADE_DE_QUADROS) {
  return new Promise((resolve) => {
    let url;
    let encerrado = false;

    const video = document.createElement('video');
    const quadros = [];

    // Uma saída só, e ela sempre solta o object URL. Sem isso o arquivo de
    // vídeo inteiro fica preso na memória do navegador (§6.1, item 4).
    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(cronometro);
      video.removeAttribute('src');
      video.load();
      if (url) URL.revokeObjectURL(url);
      resolve(quadros);
    };

    const cronometro = setTimeout(encerrar, TEMPO_MAXIMO_MS);

    try {
      url = URL.createObjectURL(arquivo);
    } catch {
      encerrar();
      return;
    }

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // Necessário para o canvas não ficar "tainted" quando a origem difere.
    video.crossOrigin = 'anonymous';
    video.src = url;

    video.onerror = encerrar;

    video.onloadedmetadata = () => {
      const duracao = video.duration;
      if (!Number.isFinite(duracao) || duracao <= 0) { encerrar(); return; }

      // Frações em vez de segundos fixos: funciona igual num vídeo de 5 s e num
      // de 5 min. Evita 0 e 1 exatos porque o primeiro e o último quadro
      // costumam ser pretos, e quadro preto não diz nada à moderação.
      const marcas = Array.from(
        { length: quantidade },
        (_, i) => duracao * ((i + 0.5) / quantidade),
      );

      const escala = Math.min(1, LARGURA_MAXIMA / (video.videoWidth || LARGURA_MAXIMA));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((video.videoWidth || LARGURA_MAXIMA) * escala));
      canvas.height = Math.max(1, Math.round((video.videoHeight || LARGURA_MAXIMA) * escala));
      const ctx = canvas.getContext('2d');

      let indice = 0;
      const proximo = () => {
        if (encerrado) return;
        if (indice >= marcas.length) { encerrar(); return; }
        video.currentTime = marcas[indice++];
      };

      video.onseeked = () => {
        if (encerrado) return;
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          quadros.push(canvas.toDataURL('image/jpeg', QUALIDADE_JPEG));
        } catch {
          // Um quadro que falhou não invalida os outros: três quadros com dois
          // aproveitados ainda é infinitamente melhor que nenhuma checagem.
        }
        proximo();
      };

      proximo();
    };
  });
}
