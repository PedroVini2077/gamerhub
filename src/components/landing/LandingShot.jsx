// Moldura padrão pras imagens reais do site exibidas na landing (substituem os
// antigos mockups desenhados). Borda + leve profundidade pra parecer um print
// "emoldurado", mantendo o visual escuro do site.
export default function LandingShot({ src, alt }) {
  return (
    <div className="rounded-xl overflow-hidden border border-dark-400 bg-dark-800 shadow-2xl">
      <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
    </div>
  );
}
