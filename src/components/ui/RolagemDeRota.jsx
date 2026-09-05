import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Decide para onde a página rola quando a rota muda.
 *
 * ── O bug que originou isto (01/09) ─────────────────────────────────────────
 *
 * Abrir "Sobre" pelo rodapé da landing caía no MEIO da página. Medido: com o
 * scroll em 4420 px no rodapé, o clique levava para `/sobre` e o scroll
 * continuava em **4420 px**.
 *
 * A causa não é bug do site: navegação do React Router é troca de rota no
 * cliente, não carregamento de documento. O navegador não tem por que mexer no
 * scroll, e o React Router v6 **não reseta por conta própria**. Sem alguém
 * dizendo o que fazer, a posição antiga simplesmente fica.
 *
 * ── Por que não é um `window.scrollTo(0,0)` jogado em qualquer lugar ────────
 *
 * Porque existem três navegações diferentes, e tratá-las igual quebra duas:
 *
 * | Navegação | O certo | O que um scrollTo cego faria |
 * | --- | --- | --- |
 * | link para outra página | ir para o topo | certo por acidente |
 * | link com âncora (`/#feed`) | rolar até a seção | **mataria a âncora** |
 * | voltar/avançar do navegador | restaurar onde a pessoa estava | **perderia o lugar** |
 *
 * O `POP` é o caso que mais se esquece: o navegador já guarda a posição de
 * quem volta, e sobrescrever isso é apagar trabalho dele.
 */
export default function RolagemDeRota() {
  const { pathname, hash } = useLocation();
  const tipo = useNavigationType();

  useEffect(() => {
    // Voltar/avançar: o navegador restaura sozinho. Não encostar.
    if (tipo === 'POP') return;

    if (hash) {
      // A seção pode ainda não estar montada (rota nova + lazy). Uma volta de
      // frame basta; sem alvo, cai no topo em vez de ficar onde estava.
      requestAnimationFrame(() => {
        const alvo = document.querySelector(hash);
        if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo(0, 0);
      });
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname, hash, tipo]);

  return null;
}
