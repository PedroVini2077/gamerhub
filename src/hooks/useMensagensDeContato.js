import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth.jsx';
import { useApenasAUltimaResposta } from './useApenasAUltimaResposta';
import {
  listarMensagensDeContato, marcarMensagemDeContato, responderMensagemDeContato,
} from '../services/contatoService';

/**
 * Estado da aba "Contato" do painel admin.
 *
 * Hook próprio, e não mais estado dentro do `Admin.jsx`, pelo motivo do §4: o
 * painel já foi um arquivo de 918 linhas onde a moderação de comentário ficou
 * quebrada por meses sem ninguém notar, porque ninguém consegue revisar um
 * arquivo que não cabe na tela.
 */
export function useMensagensDeContato() {
  const { user, profile } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('new');

  // `[24/09]` `carregar` roda por troca de filtro E depois de marcar/responder.
  // Duas em voo e a velha sobrescreve — aqui o piso de 500 ms abaixo ALARGA a
  // janela de propósito, então a corrida é mais provável do que parece.
  const novoPedido = useApenasAUltimaResposta();

  const carregar = useCallback(async (status = filtro) => {
    const aindaVale = novoPedido();
    setCarregando(true);
    // O piso de 500 ms do §4: sem ele o giro do ícone pisca e a pessoa não tem
    // como saber se o botão funcionou.
    const [{ data, error }] = await Promise.all([
      listarMensagensDeContato({ status: status === 'todos' ? null : status }),
      new Promise(r => setTimeout(r, 500)),
    ]);
    if (!aindaVale()) return;
    setCarregando(false);
    if (error) {
      toast.error('Não foi possível carregar as mensagens: ' + error.message);
      return;
    }
    setMensagens(data);
  }, [filtro, novoPedido]);

  const marcar = useCallback(async (id, status) => {
    const { error } = await marcarMensagemDeContato(id, status, {
      userId: user?.id, username: profile?.username,
    });
    // `marcarMensagemDeContato` usa `count: 'exact'` e trata 0 linhas como
    // falha. Sem isso a RLS negaria em silêncio e este toast diria "marcada"
    // com nada tendo mudado (§1.5).
    if (error) { toast.error(error.message); return; }
    toast.success('Mensagem atualizada.');
    // Recarrega em vez de mexer na lista local: com filtro por status, a
    // mensagem que acabou de mudar pode não pertencer mais à lista visível, e
    // uma atualização otimista faria ela sumir ou ficar dependendo do filtro.
    await carregar();
  }, [carregar, user?.id, profile?.username]);

  /**
   * `[03/09]` Responder de verdade — e o status vem como CONSEQUÊNCIA.
   *
   * Não existe mais um `marcar(id, 'answered')`: o painel só chega nesse estado
   * porque um e-mail saiu. Era o defeito que o dono apontou — um botão
   * afirmando um ato que o sistema não executava (§1.5).
   */
  const responder = useCallback(async (id, texto) => {
    const { error } = await responderMensagemDeContato(id, texto);
    if (error) { toast.error(error.message); return false; }
    toast.success('Resposta enviada por e-mail.');
    await carregar();
    return true;
  }, [carregar]);

  return { mensagens, carregando, filtro, setFiltro, carregar, marcar, responder };
}
