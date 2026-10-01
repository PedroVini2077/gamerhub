import { useEffect, useState } from 'react';

/**
 * `[01/10]` Diz se o elemento está dentro da viewport, e continua dizendo.
 *
 * ── Por que o padrão é `true`, e essa é a decisão que importa ──────────────
 *
 * Quem usa isto normalmente quer mostrar algo **quando o alvo sai da tela** —
 * um atalho flutuante, um "voltar ao topo". Se o estado inicial fosse `false`,
 * o atalho **piscaria** no primeiro quadro de toda carga, com o alvo ainda na
 * cara da pessoa, até o observador corrigir.
 *
 * Então o padrão é *"assume que está na tela até provarem o contrário"*. O
 * `IntersectionObserver` dispara assim que começa a observar, logo a correção
 * chega no quadro seguinte — invisível para o olho, e sempre no sentido
 * seguro.
 *
 * ── Navegador sem `IntersectionObserver` (e o jsdom dos testes) ────────────
 *
 * Fica `true` para sempre. Degradar para "o atalho nunca aparece" é certo: o
 * alvo original continua lá, e atalho travado na tela é pior do que atalho
 * nenhum. O contrário — degradar para `false` — grudaria um botão flutuante
 * em cima do conteúdo sem jeito de sumir.
 *
 * @param {{current: Element|null}} ref o elemento a vigiar
 * @param {{rootMargin?: string}} [opcoes]
 * @returns {boolean} `true` enquanto o elemento estiver (ou se presumir) visível
 */
export function useNaTela(ref, { rootMargin = '0px' } = {}) {
  const [naTela, setNaTela] = useState(true);

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo || typeof IntersectionObserver === 'undefined') return undefined;

    const vigia = new IntersectionObserver(
      ([entrada]) => setNaTela(entrada.isIntersecting),
      { rootMargin },
    );
    vigia.observe(alvo);
    return () => vigia.disconnect();
  }, [ref, rootMargin]);

  return naTela;
}
