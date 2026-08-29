import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Vigia se a conta logada foi banida enquanto a pessoa usava o site.
 *
 * ── Por que saiu do `useAuth.jsx` ───────────────────────────────────────────
 *
 * O `useAuth` passou de 300 linhas e é o arquivo de maior risco do projeto
 * (`CLAUDE.md` §7): quebrá-lo derruba o site inteiro. Dentro dele conviviam
 * duas responsabilidades bem diferentes — o ESTADO de sessão e perfil, que a
 * árvore inteira consome, e a VIGILÂNCIA de sistemas externos (um canal de
 * realtime, um timer, um ouvinte de visibilidade), que não devolve nada a
 * ninguém e só dispara um callback.
 *
 * A separação é mecânica: nenhum comportamento mudou aqui. O que mudou é que
 * esta parte passou a ser montável e testável isolada, o que o `useAuth`
 * inteiro nunca foi — ele depende de sessão do Supabase, de React e da árvore
 * de contexto, e um teste dele viraria um teste dos mocks.
 *
 * ── Os dois caminhos, e por que existem os dois ─────────────────────────────
 *
 * | Caminho | Quando serve |
 * | --- | --- |
 * | realtime no próprio perfil | instantâneo, é o caso normal |
 * | poll de 60 s + volta do foco | quando o realtime perde o evento (timing da assinatura, reconexão) |
 *
 * O poll roda **só com a aba visível**. Antes eram 20 s sempre, inclusive em
 * segundo plano: um SELECT por usuário logado a cada 20 s sem ninguém olhando.
 * A revalidação ao voltar o foco cobre o buraco que isso abriria — é
 * justamente o momento em que a pessoa poderia agir sem saber que foi banida.
 *
 * @param {string|undefined} userId
 * @param {() => void} revalidar chamado quando há suspeita de ban. **Precisa
 *   ser estável** (`useCallback`): ele entra nas dependências do efeito, e um
 *   callback novo a cada render derrubaria e recriaria o canal de realtime sem
 *   parar. Existe teste para isso.
 */
export function useVigiaDeBanimento(userId, revalidar) {
  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`profile-ban-watch-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        // O evento é só GATILHO: relemos pela RPC em vez de confiar no payload.
        //
        // Medido em 23/08: o Realtime **respeita privilégio de coluna**, então
        // `payload.new.banned` é confiável. Mesmo assim relemos, por outro
        // motivo — a tela do banido precisa de `ban_reason`, e isso o payload
        // não traz (a coluna é revogada de `authenticated`).
        if (payload.new?.banned) revalidar();
      })
      .subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') revalidar();
    }, 60000);

    function aoVoltar() {
      if (document.visibilityState === 'visible') revalidar();
    }
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [userId, revalidar]);
}
