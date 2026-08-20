import { useState, useRef, useEffect } from 'react';

/**
 * Só monta os filhos quando o bloco chega perto da viewport.
 *
 * Motivo: mídia de post (imagem/vídeo) fora da tela não deve consumir banda.
 * Num feed de 30 posts, a maioria nunca é vista — mas o `<img>`/`<video>`
 * montado dispara request mesmo assim (o `loading="lazy"` do browser ajuda em
 * imagem, mas não em vídeo, e não impede o carrossel de montar).
 *
 * `rootMargin` adianta a montagem antes de entrar na tela, então o usuário que
 * rola normalmente não vê buraco.
 */
export default function LazyVisible({ children, minHeight = 0, rootMargin = '400px' }) {
  const ref = useRef(null);
  // Sem IntersectionObserver (browser antigo / jsdom nos testes) renderiza
  // direto — degradar pra "carrega tudo" é melhor do que não mostrar nada.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
