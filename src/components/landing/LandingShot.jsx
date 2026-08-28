// Moldura padrão pras imagens reais do site exibidas na landing (substituem os
// antigos mockups desenhados). Borda + leve profundidade pra parecer um print
// "emoldurado", mantendo o visual escuro do site.
// `width`/`height` são o tamanho REAL do arquivo, não o exibido: com eles o
// navegador calcula a proporção e reserva a altura certa antes de a imagem
// chegar. Sem isso o conteúdo abaixo pula quando cada print carrega durante a
// rolagem. Os números vêm de `dimensoesDosPrints.js`, que tem teste conferindo
// contra os arquivos.
export default function LandingShot({ src, alt, width, height }) {
  return (
    <div className="rounded-xl overflow-hidden border border-dark-400 bg-dark-800 shadow-2xl">
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="w-full h-auto block"
      />
    </div>
  );
}
