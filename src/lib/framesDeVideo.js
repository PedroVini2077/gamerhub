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

// Teto POR SALTO, e ele existe por um motivo diferente do teto geral. O evento
// `seeked` não é garantido: navegador que já está na posição pedida não dispara
// nada, e vídeo muito curto faz as três marcas caírem dentro da mesma
// granularidade de busca. Sem este teto, um salto travado consumia os 15 s
// inteiros e levava junto os quadros que já tinham dado certo — o resultado
// virava zero quadros, que é indistinguível de "vídeo limpo" (§1.5).
const TEMPO_POR_SALTO_MS = 4000;

/**
 * Um vídeo cuja duração o navegador só descobre depois de procurar o fim.
 *
 * `video.duration === Infinity` é um caso REAL e comum — acontece com arquivos
 * gravados em streaming (o cabeçalho sai antes de a duração ser conhecida) e
 * com boa parte do que sai de câmera de celular. A versão anterior desistia
 * calada nesse caso, e era um dos cinco caminhos que devolviam lista vazia sem
 * dizer por quê.
 *
 * A saída conhecida é procurar um instante absurdamente distante: o navegador
 * é obrigado a varrer até o fim para atender o pedido, e aí a duração vira um
 * número. Depois disso a amostragem normal funciona.
 */
const INSTANTE_ABSURDO = 1e6;

/**
 * Um quadro que o `<canvas>` recebeu de fato tem pixels OPACOS.
 *
 * ── Por que isto existe, e é a falha mais perigosa das que já apareceram aqui ─
 *
 * `drawImage` com um vídeo que o navegador não decodificou **não lança**: ele
 * simplesmente não desenha nada. O `<canvas>` nasce totalmente transparente,
 * então o resultado é um JPEG válido, do tamanho certo, e em branco — e ele
 * seguia para a moderação, que devolvia `score 0`. O vídeo era então marcado
 * como **analisado e limpo**, que é pior do que não ter sido analisado: o
 * primeiro caso mente, o segundo pelo menos aparece como pendência.
 *
 * Quadro de vídeo é sempre opaco (alpha 255). Alpha 0 em toda a amostra prova
 * que nada foi desenhado — não é julgamento sobre o conteúdo, é a diferença
 * entre ter pixel e não ter.
 *
 * @param {Uint8ClampedArray|number[]} dados RGBA vindo de `getImageData`
 * @returns {boolean} `true` quando NADA foi desenhado
 */
export function nadaFoiDesenhado(dados) {
  if (!dados?.length) return true;
  for (let i = 3; i < dados.length; i += 4) {
    if (dados[i] !== 0) return false;
  }
  return true;
}

/**
 * @param {File|Blob} arquivo vídeo escolhido pelo usuário
 * @returns {Promise<{quadros: string[], motivo: string|null}>} `quadros` são
 *   data URLs JPEG; `motivo` diz por que a lista veio vazia (ou `null` quando
 *   deu certo). Lista vazia é **"não analisado"**, nunca "analisado e limpo".
 *
 * ── Por que devolve MOTIVO, e não só a lista ────────────────────────────────
 *
 * Porque em 28/08 um vídeo real falhou e ninguém conseguiu dizer por quê. A
 * versão anterior tinha **cinco** caminhos diferentes terminando no mesmo
 * `resolve([])`: `createObjectURL` estourando, formato que o navegador não
 * decodifica, duração não finita, o teto de 15 s, e todo `drawImage` falhando.
 * Cinco causas, um sintoma, nenhuma pista — e as correções de cada uma são
 * completamente diferentes.
 */
export function extrairQuadros(arquivo, quantidade = QUANTIDADE_DE_QUADROS) {
  return new Promise((resolve) => {
    let url;
    let encerrado = false;
    let duracaoResolvida = false;

    const video = document.createElement('video');
    const quadros = [];

    // Uma saída só, e ela sempre solta o object URL. Sem isso o arquivo de
    // vídeo inteiro fica preso na memória do navegador (§6.1, item 4).
    const encerrar = (motivo = null) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(cronometro);
      video.removeAttribute('src');
      video.load();
      video.remove();
      if (url) URL.revokeObjectURL(url);
      resolve({ quadros, motivo: quadros.length ? null : (motivo ?? 'motivo_desconhecido') });
    };

    const cronometro = setTimeout(
      () => encerrar(`estourou o teto de ${TEMPO_MAXIMO_MS} ms`),
      TEMPO_MAXIMO_MS,
    );

    try {
      url = URL.createObjectURL(arquivo);
    } catch {
      encerrar('o navegador recusou criar a URL do arquivo');
      return;
    }

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // `crossOrigin` SAIU. Ele foi escrito para evitar canvas "tainted", mas a
    // origem aqui é sempre `blob:` do próprio documento — mesma origem por
    // construção, então não havia o que proteger. E declarar CORS numa URL
    // `blob:` faz o navegador tratar a carga como requisição de outra origem,
    // que é justamente o tipo de recusa silenciosa que estamos caçando.
    video.src = url;

    // Fora da tela, mas DENTRO do documento. Navegador de celular costuma
    // recusar decodificar vídeo de elemento solto na memória — e o sintoma é
    // exatamente o desta falha: nada acontece, sem erro nenhum.
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(video);

    // O empurrão. `preload` é uma DICA, e o Safari do iPhone a ignora fora de
    // gesto do usuário — e aqui o gesto já expirou, porque entre o clique em
    // "Publicar" e esta linha houve o upload inteiro. Sem carga, nem
    // `loadedmetadata` nem `error` disparam: o arquivo fica parado e a única
    // coisa que acontece é o teto de 15 s estourar.
    //
    // `play()` num vídeo mudo e `playsInline` é permitido sem gesto desde o
    // iOS 10, e obriga o navegador a decodificar. A pausa vem no
    // `loadedmetadata`: a partir dali quem manda na posição é o salto.
    video.load();
    video.play().catch(() => { /* navegador que recusa autoplay já carregou pelo load() */ });

    video.onerror = () => encerrar(
      `o navegador não decodificou o arquivo (tipo: ${arquivo?.type || 'desconhecido'})`,
    );

    video.onloadedmetadata = () => {
      video.pause();
      // Duração desconhecida: força o navegador a varrer até o fim.
      if (!Number.isFinite(video.duration) && !duracaoResolvida) {
        duracaoResolvida = true;
        video.currentTime = INSTANTE_ABSURDO;
        return;
      }
      comecarAmostragem();
    };

    // Depois do salto para o instante absurdo, a duração vira um número e o
    // navegador dispara `durationchange`.
    video.ondurationchange = () => {
      if (encerrado || !duracaoResolvida) return;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        duracaoResolvida = false;   // não repetir o truque
        video.ondurationchange = null;
        comecarAmostragem();
      }
    };

    function comecarAmostragem() {
      const duracao = video.duration;
      if (!Number.isFinite(duracao) || duracao <= 0) {
        encerrar(`o navegador não soube dizer a duração (${duracao})`);
        return;
      }
      // Sem dimensão não há o que desenhar, e o `|| LARGURA_MAXIMA` de antes
      // fabricava um canvas 512×512 que ficava transparente — quadro em branco
      // seguindo para a moderação como se fosse conteúdo.
      if (!video.videoWidth || !video.videoHeight) {
        encerrar('o navegador não expôs as dimensões do vídeo (faixa de vídeo ausente ou não decodificada)');
        return;
      }

      // Frações em vez de segundos fixos: funciona igual num vídeo de 5 s e num
      // de 5 min. Evita 0 e 1 exatos porque o primeiro e o último quadro
      // costumam ser pretos, e quadro preto não diz nada à moderação.
      const marcas = Array.from(
        { length: quantidade },
        (_, i) => duracao * ((i + 0.5) / quantidade),
      );

      const escala = Math.min(1, LARGURA_MAXIMA / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
      canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
      const ctx = canvas.getContext('2d');

      let indice = 0;
      let falhasAoDesenhar = 0;
      let emBranco = 0;
      let vigia;

      const proximo = () => {
        clearTimeout(vigia);
        if (encerrado) return;
        if (indice >= marcas.length) {
          encerrar(motivoDaAmostragemVazia());
          return;
        }
        // O vigia por salto: se `seeked` não vier, segue para a próxima marca
        // em vez de deixar o teto geral levar junto o que já deu certo.
        vigia = setTimeout(proximo, TEMPO_POR_SALTO_MS);
        video.currentTime = marcas[indice++];
      };

      const motivoDaAmostragemVazia = () => {
        if (emBranco) return `o navegador devolveu ${emBranco} quadro(s) em branco — o vídeo não foi decodificado`;
        if (falhasAoDesenhar) return `o canvas recusou desenhar os ${falhasAoDesenhar} quadros`;
        return 'nenhum salto no vídeo chegou a completar';
      };

      video.onseeked = () => {
        if (encerrado) return;
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // A conferência que faltava. Um quadro transparente prova que o
          // `drawImage` não teve o que desenhar — e ele NÃO lança nesse caso,
          // então sem esta checagem o JPEG em branco ia para a moderação e
          // voltava "limpo" (ver `nadaFoiDesenhado`).
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          if (nadaFoiDesenhado(data)) emBranco++;
          else quadros.push(canvas.toDataURL('image/jpeg', QUALIDADE_JPEG));
        } catch {
          // Um quadro que falhou não invalida os outros: três quadros com dois
          // aproveitados ainda é infinitamente melhor que nenhuma checagem.
          falhasAoDesenhar++;
        }
        proximo();
      };

      proximo();
    }
  });
}
