import { useEffect, useRef } from 'react';

/**
 * Chama `callback` de tempos em tempos, mas SÓ com a aba visível.
 *
 * Existe para substituir assinaturas de realtime caras. O caso concreto:
 * `admin_logs` estava na publicação `supabase_realtime`, então TODO admin com
 * o painel aberto recebia uma mensagem a cada linha de log gravada no site
 * inteiro — mesmo com a aba de logs fechada. Log é tabela de auditoria de alto
 * volume; realtime ali é o pior custo/benefício do projeto.
 *
 * Polling só enquanto a pessoa está de fato olhando a aba resolve o mesmo
 * problema por uma fração do tráfego. Mesmo padrão que o `useAuth` já usa no
 * fallback de detecção de ban.
 *
 * @param callback  o que rodar a cada tique
 * @param intervalMs intervalo entre tiques
 * @param enabled   quando falso, não agenda nada (ex.: aba não selecionada)
 */
export function useVisiblePoll(callback, intervalMs, enabled = true) {
  // O callback quase sempre é recriado a cada render; guardá-lo em ref evita
  // que o intervalo seja destruído e recriado junto.
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; });

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    const tick = () => {
      if (document.visibilityState === 'visible') cbRef.current?.();
    };
    const id = setInterval(tick, intervalMs);

    // Voltar para a aba depois de um tempo fora é justamente quando o dado
    // está mais defasado — revalida na hora em vez de esperar o próximo tique.
    const onVisible = () => {
      if (document.visibilityState === 'visible') cbRef.current?.();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);
}
