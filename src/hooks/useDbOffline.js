import { useSyncExternalStore } from 'react';
import { bancoForaDoAr, observarSaudeDoBanco } from '../lib/dbHealth';

/**
 * `true` enquanto o site estiver sem acesso ao banco. Ver `lib/dbHealth.js`.
 *
 * `useSyncExternalStore` e não `useState` + `useEffect`: o estado vive FORA do
 * React (no módulo que instrumenta o `fetch`), e esta é a API feita exatamente
 * para esse caso. De quebra evita o buraco do par useState/useEffect — a queda
 * pode ser detectada entre o render e o efeito rodar, e ali o valor inicial
 * ficaria desatualizado.
 */
export function useDbOffline() {
  return useSyncExternalStore(observarSaudeDoBanco, bancoForaDoAr, () => false);
}
