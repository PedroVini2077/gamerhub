import { QueryClient } from '@tanstack/react-query';

// Cliente único de cache do React Query. Defaults pensados pro GamerHub:
// - staleTime 30s: dados ficam "frescos" por 30s, evitando refetch em toda
//   montagem/navegação (menos requests, menos egress — alinhado ao corte de
//   banda que fizemos no storage).
// - refetchOnWindowFocus false: não refazer toda query ao voltar pra aba; o
//   que precisa de tempo-real já usa `useRealtime` pra invalidar pontualmente.
// - retry 1: uma tentativa extra em falha de rede, sem martelar o backend.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
