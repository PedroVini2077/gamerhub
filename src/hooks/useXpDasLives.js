import { useCallback, useState } from 'react';
import {
  listarLivesRealizadas, invalidarLiveRealizada, revalidarLiveRealizada,
} from '../services/liveXpService';
import { useApenasAUltimaResposta } from './useApenasAUltimaResposta';

/**
 * Estado da aba de XP das lives.
 *
 * `carregar` é estável (`useCallback` sem deps) pelo mesmo motivo do
 * `fetchLiveMod`: o canal de realtime do Admin a chama, e identidade nova a
 * cada render re-assinaria o canal.
 */
export function useXpDasLives() {
  const [sessoes, setSessoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  // `[24/09]` `carregar` é chamada pelo canal de realtime E depois de
  // invalidar/revalidar. Duas em voo, e a velha sobrescreve a nova — a mesma
  // corrida que fez o comentário sumir da tela. O porquê está no hook.
  const novoPedido = useApenasAUltimaResposta();

  const carregar = useCallback(async () => {
    const aindaVale = novoPedido();
    setCarregando(true);
    const r = await listarLivesRealizadas(30);
    // Devolve `r` para quem chamou mesmo quando a resposta foi superada: quem
    // aguarda o retorno quer saber do PRÓPRIO pedido; o que não pode é pintar
    // a tela com dado velho.
    if (!aindaVale()) return r;
    // O erro NÃO é engolido: a lista vazia e a lista que falhou são estados
    // diferentes, e a tela precisa dizer qual é qual (§1.5).
    setErro(r.error ? (r.error.message || 'Não foi possível carregar.') : null);
    setSessoes(r.data || []);
    setCarregando(false);
    return r;
  }, [novoPedido]);

  const invalidar = useCallback(async (id, motivo) => {
    const r = await invalidarLiveRealizada(id, motivo);
    if (!r.error) await carregar();
    return r;
  }, [carregar]);

  const revalidar = useCallback(async (id) => {
    const r = await revalidarLiveRealizada(id);
    if (!r.error) await carregar();
    return r;
  }, [carregar]);

  return { sessoes, carregando, erro, carregar, invalidar, revalidar };
}
