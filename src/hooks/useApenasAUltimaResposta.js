import { useCallback, useRef } from 'react';

/**
 * `[24/09]` Descarta resposta de busca que já foi SUPERADA por outra.
 *
 * ── O bug que originou isto, e ele é de uma classe inteira ─────────────────
 *
 * Duas buscas do mesmo dado disputando o mesmo `setState`: uma disparada por
 * um efeito (abrir a seção, mudar o filtro, um evento de realtime) e outra
 * disparada logo depois de uma escrita. Se a PRIMEIRA pegar uma conexão lenta
 * e responder por ÚLTIMO, ela devolve o estado de ANTES da escrita e apaga o
 * que acabou de aparecer.
 *
 * Medido num E2E de 24/09: o comentário aparecia na tela e sumia segundos
 * depois, vivo no banco, sem erro e sem log — as três respostas do teste dos
 * três canais em "nada" (§1.5). É a 3ª armadilha da FASE 1 do §6, *"resposta
 * velha sobrescrevendo a nova"*, que estava escrita na régua de auditoria e
 * nunca tinha sido testada.
 *
 * ── Por que um hook, e não a mesma linha copiada em cada lugar ─────────────
 *
 * Porque são três lugares hoje e vão ser mais amanhã, e cópia diverge (§4).
 * Neste projeto já divergiram ícones de log, rótulos de cargo e a regra de
 * bloqueio de login — sempre pelo mesmo caminho.
 *
 * ── Como usar ─────────────────────────────────────────────────────────────
 *
 *     const novoPedido = useApenasAUltimaResposta();
 *
 *     const carregar = useCallback(async () => {
 *       const aindaVale = novoPedido();      // ANTES de sair da linha
 *       const { data } = await buscar();
 *       if (!aindaVale()) return;            // alguém pediu depois de mim
 *       setLista(data);
 *     }, [novoPedido]);
 *
 * O `novoPedido()` precisa ser chamado **antes** do `await`: é ele que marca a
 * ordem. Chamar depois mediria o instante errado e o guard não protegeria
 * nada — ficaria verde sempre, que é a pior espécie de proteção.
 *
 * ── O que ele NÃO faz ─────────────────────────────────────────────────────
 *
 * Não cancela a requisição: ela termina e o resultado é descartado. Cancelar
 * de verdade exigiria `AbortController` atravessando o `supabase-js`, que não
 * o expõe nas consultas. O custo do que sobra é uma resposta ignorada — o
 * egress já foi gasto de qualquer forma quando a busca saiu.
 *
 * `useRef` e não `useState` de propósito: o contador não pinta nada, e mudá-lo
 * não pode disparar render.
 */
export function useApenasAUltimaResposta() {
  const pedido = useRef(0);

  return useCallback(() => {
    const meuPedido = ++pedido.current;
    return () => meuPedido === pedido.current;
  }, []);
}
