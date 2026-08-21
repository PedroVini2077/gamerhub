// Controle de blob URLs (URL.createObjectURL).
//
// Um blob URL segura o arquivo INTEIRO na memória do navegador até alguém
// chamar revokeObjectURL. Quem cria e esquece de revogar vaza — e o vazamento
// não aparece em teste nenhum, só na memória de quem usa o site.
//
// O problema real que originou isto: o formulário de post criava uma prévia
// por mídia anexada e, ao publicar, limpava a lista com `setMedias([])` sem
// revogar nada. Cada post publicado deixava para trás até 10 arquivos (5MB por
// imagem, 10MB por vídeo) presos pelo resto da sessão — e o feed é SPA, então
// "o resto da sessão" pode ser horas.
//
// A saída é não deixar o revoke por conta de quem chama: quem cria a URL
// registra, e existe um `releaseAll` para o desmonte e para os resets em massa,
// onde é fácil esquecer um caminho.

/** Cria um rastreador de blob URLs com revogação garantida. */
export function createUrlTracker() {
  const urls = new Set();

  return {
    /** Cria a URL do arquivo e passa a rastreá-la. */
    track(file) {
      const url = URL.createObjectURL(file);
      urls.add(url);
      return url;
    },

    /** Revoga uma URL específica. Ignora null/undefined e URL já revogada. */
    release(url) {
      if (!url || !urls.has(url)) return;
      URL.revokeObjectURL(url);
      urls.delete(url);
    },

    /** Revoga tudo que ainda está vivo. Use no desmonte e nos resets. */
    releaseAll() {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    },

    /** Quantas URLs seguem vivas — existe para os testes conseguirem afirmar. */
    get size() {
      return urls.size;
    },
  };
}
