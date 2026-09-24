import { useState, useRef, useCallback, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeedPosts } from '../services/postService';
import { recarregarAteAparecer } from '../lib/recarregarAteAparecer';
import { useRealtime } from './useRealtime';
import { apenasData } from '../services/result';
import { entraNoFeed, somarNovo } from '../lib/novidadeDoFeed';

/**
 * `[24/09]` O estado do Feed — busca, recarga e detecção de novidade.
 *
 * ── Por que ele saiu do `Home.jsx` ────────────────────────────────────────
 *
 * O `Home` acumulava seis responsabilidades: buscar dado, assinar realtime,
 * contar novidade, filtrar, desenhar a tela e hospedar o composer. Isso é o
 * segundo gatilho do §4 — *"mistura responsabilidades"* —, e ele importa mais
 * do que o número de linhas: a Fase 0 do bloco do Feed mostrou que a paginação
 * entra exatamente aqui, e ela não cabe numa tela que também desenha.
 *
 * **Este corte é MECÂNICO.** Nenhum comportamento mudou: mesma consulta, mesmo
 * limite de 30, mesmo contador, mesma assinatura de realtime. O que muda é
 * onde o código mora. A ordem do §4 é essa — extrair primeiro, melhorar
 * depois, nunca junto.
 *
 * ── O que ele NÃO faz, e é de propósito ───────────────────────────────────
 *
 * `[24/09]` **Passou a paginar** — era o defeito que a Fase 0 mediu (o post
 * nº 31 era inalcançável). O cursor e o porquê do keyset estão no
 * `postService.fetchFeedPosts`.
 *
 * Não filtra. Busca e categoria continuam no `Home`, porque as duas vão
 * embora no bloco do Feed (busca vira consulta ao banco, categoria sai da
 * experiência) e movê-las agora seria mudar de lugar o que vai ser removido.
 */
export function useFeed(userId) {
  const [novos, setNovos] = useState(0);

  // O handler de realtime precisa do usuário ATUAL sem re-assinar o canal a
  // cada render. O ref é atualizado num efeito (escrever em ref durante o
  // render é inseguro com renderização concorrente).
  const userRef = useRef(userId);
  const debounceRef = useRef(null);
  useEffect(() => { userRef.current = userId; }, [userId]);

  // `[24/09]` Paginação por CURSOR. `useInfiniteQuery` e não `useQuery`: é ele
  // que guarda as páginas já carregadas e o cursor da próxima, sem o feed
  // precisar remontar a lista inteira a cada lote — que é o requisito de "não
  // interromper quem está lendo".
  //
  // O viewer entra na queryKey: "eu curti" faz parte do resultado em lote,
  // então o cache não pode ser compartilhado entre usuários diferentes.
  const {
    data, isPending: carregando, isSuccess, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed_posts', userId ?? null],
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      apenasData(fetchFeedPosts({ cursor: pageParam, viewerId: userId ?? null })),
    // `temMais` vem do banco (a página pediu um item a mais), então o botão de
    // "carregar mais" some no lote certo em vez de aparecer e não trazer nada.
    getNextPageParam: (ultima) => (ultima?.temMais ? ultima.proximoCursor : undefined),
  });

  // A lista que a tela desenha é a concatenação das páginas, na ordem.
  const posts = (data?.pages ?? []).flatMap((p) => p?.posts ?? []);

  /**
   * Recarrega o feed e zera o contador de "novos posts".
   *
   * ── `[02/09]` Por que ele CONFERE em vez de só recarregar ────────────────
   *
   * O bug que estava no backlog há dias: publicar e o post não aparecer.
   * Aconteceu de novo no CI, e desta vez sobrou evidência no banco:
   *
   *   post criado ....... 10:18:03, `deleted_at` nulo (existia mesmo)
   *   feed capturado .... 10:18:33, TRINTA segundos depois, sem ele
   *   e mostrando ....... um post que já tinha sido apagado às 10:18:10
   *
   * Ou seja: a leitura trouxe dado ANTERIOR à escrita. É leitura logo após
   * escrita caindo numa conexão do pool que ainda não enxergava a linha — o
   * `createPost` já tinha retornado com sucesso.
   *
   * O `refetch()` sozinho não tem como saber disso: ele recebeu uma resposta
   * válida, só que velha. E como nada tentava de novo, o feed ficava mentindo
   * até a pessoa navegar — do lado dela, o site comeu o que ela escreveu.
   *
   * Com o id em mãos dá para PERGUNTAR se a resposta já contém o post, e
   * insistir por alguns instantes se não contiver. Sem id (deletar, botão de
   * novos posts), o comportamento é o de antes.
   */
  const recarregar = useCallback(async (idEsperado) => {
    setNovos(0);
    // A decisão de insistir mora em `lib/recarregarAteAparecer.js`, separada
    // de propósito: a corrida acontece no pool do Supabase e não se reproduz
    // num navegador de teste. Como função pura ela é testável de verdade.
    await recarregarAteAparecer(
      async () => (await refetch()).data,
      idEsperado,
    );
  }, [refetch]);

  // Só INSERT e DELETE: o handler não faz nada com UPDATE, e cada UPDATE de
  // post (edição, contadores) viraria uma mensagem de realtime pra todo mundo
  // que está com o feed aberto.
  useRealtime('posts', (payload) => {
    if (!isSuccess) return;
    if (payload.eventType === 'INSERT') {
      // `[24/09]` Só conta o que APARECERIA no feed. Antes contava todo
      // INSERT, e abrir uma live somava "1 nova publicação" para todo mundo —
      // com a recarga não trazendo nada, porque a consulta exclui live. O
      // porquê inteiro e o teto estão em `lib/novidadeDoFeed.js`.
      if (!entraNoFeed(payload.new)) return;
      if (payload.new?.user_id === userRef.current) {
        setTimeout(() => recarregar(), 5000);
      } else setNovos(somarNovo);
    }
    if (payload.eventType === 'DELETE') {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => recarregar(), 500);
    }
  }, { events: ['INSERT', 'DELETE'] });

  return {
    posts, carregando, novos, recarregar,
    // O "carregar mais" é do USUÁRIO, não automático: o pedido do dono é
    // indicador discreto -> ele decide -> atualiza.
    carregarMais: fetchNextPage,
    temMais: !!hasNextPage,
    carregandoMais: isFetchingNextPage,
  };
}
