import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { endLivePost } from '../services/postService';
import {
  fetchLiveMessages, fetchLiveTimeouts, sendChatMessage,
  deleteChatMessage, silenceUser, unsilenceUser,
} from '../services/liveService';
import { logAudit } from '../lib/auditLog';
import { useBlockedWords } from './useBlockedWords';
import { moderateText } from '../services/moderationService';

const isActive = t => t && new Date(t.expires_at) > new Date();

/**
 * Toda a sala da live: chat, presença, silenciamentos e encerramento.
 *
 * Recebe a live já selecionada — quem escolhe qual live está aberta é a página.
 * Quando `activeLive` muda (inclusive para null, ao sair), o estado da sala é
 * zerado aqui dentro, então a página não precisa mexer em nada disso na mão.
 */
export function useLiveChat({ activeLive, user, profile, isAdmin }) {
  const { checkContent } = useBlockedWords();
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [timeouts, setTimeouts] = useState({});
  const [isSilenced, setIsSilenced] = useState(false);
  const [liveEnded, setLiveEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [silenceMenu, setSilenceMenu] = useState(null);
  const [silencingUser, setSilencingUser] = useState(null);
  const bottomRef = useRef(null);
  const chatInputRef = useRef(null);
  // Os callbacks de realtime são registrados uma vez por live; sem o ref eles
  // capturariam o `activeLive` do render em que o canal foi montado.
  const activeLiveRef = useRef(null);

  useEffect(() => {
    activeLiveRef.current = activeLive;
  }, [activeLive]);

  async function fetchMessages(postId) {
    if (!postId) return;
    const { data } = await fetchLiveMessages(postId);
    setMessages(data);
  }

  async function fetchTimeouts(postId) {
    if (!postId) return;
    const { data: map } = await fetchLiveTimeouts(postId);
    setTimeouts(map);
    setIsSilenced(!!(user && isActive(map[user.id])));
  }

  useEffect(() => {
    // Zera a sala anterior antes de montar a nova (e ao sair, quando
    // `activeLive` vira null e o efeito para aqui).
    setMessages([]);
    setLiveEnded(false);
    setViewerCount(0);
    if (!activeLive) return;

    fetchMessages(activeLive.id);
    fetchTimeouts(activeLive.id);

    let expiryTimeout = null;
    if (activeLive.expires_at) {
      const remaining = new Date(activeLive.expires_at) - Date.now();
      if (remaining <= 0) setLiveEnded(true);
      else expiryTimeout = setTimeout(() => setLiveEnded(true), remaining);
    }

    const presenceChannel = supabase.channel(`presence-${activeLive.id}`, {
      config: { presence: { key: user?.id || 'anon' } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        setViewerCount(Object.keys(presenceChannel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user?.id, at: Date.now() });
        }
      });

    const refreshMessages = () => {
      if (activeLiveRef.current?.id) fetchMessages(activeLiveRef.current.id);
    };

    const channel = supabase.channel(`live-${activeLive.id}`)
      // Filtro por post no servidor para INSERT/UPDATE — o volume real do chat.
      // Antes o cliente assinava TODA a tabela `live_chat` e descartava no JS o
      // que não era desta live: com N lives simultâneas, cada mensagem de
      // qualquer uma acordava todo mundo.
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'live_chat',
        filter: `post_id=eq.${activeLive.id}`,
      }, refreshMessages)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'live_chat',
        filter: `post_id=eq.${activeLive.id}`,
      }, refreshMessages)
      // DELETE fica SEM filtro de propósito: no payload de delete só vem a PK
      // (replica identity default), então `post_id=eq.…` nunca casaria e
      // mensagem apagada por mod não sumiria da tela dos outros. É evento raro.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_chat' },
        refreshMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_timeouts' },
        () => fetchTimeouts(activeLiveRef.current?.id))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'posts',
        filter: `id=eq.${activeLive.id}`,
      }, (payload) => {
        if (!payload.new?.is_live) setLiveEnded(true);
      })
      .subscribe();

    return () => {
      if (expiryTimeout) clearTimeout(expiryTimeout);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(channel);
    };
    // Só `activeLive`: incluir as funções de fetch remontaria os canais a cada
    // render. Elas leem o resto por ref/closure atualizada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLive]);

  // Rolar para o fim a cada mensagem nova, exceto enquanto a pessoa está
  // digitando — puxar o scroll debaixo do cursor é hostil.
  useEffect(() => {
    if (document.activeElement === chatInputRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!msg.trim() || !user || !activeLive || sending || isSilenced) return;
    const texto = msg.trim();

    // O chat de live era o único lugar do site sem filtro nenhum — nem lista de
    // palavras, nem IA. É justamente onde ofensa acontece em tempo real.
    if (checkContent(texto).blocked) {
      toast.error('Mensagem não enviada: contém termo bloqueado.');
      return;
    }

    setSending(true);
    const { data: id, error } = await sendChatMessage({
      postId: activeLive.id, userId: user.id, message: texto,
    });
    setSending(false);

    // Erro aqui era descartado: o campo limpava e a pessoa achava que enviou.
    if (error) {
      toast.error(error.message || 'Não foi possível enviar a mensagem.');
      return;
    }

    setMsg('');
    // Fire-and-forget, igual ao post e ao comentário: não segura o chat. Chat é
    // efêmero, então a IA não oculta — enfileira para o admin revisar.
    if (id) moderateText('chat', id, texto);
  }

  async function deleteMessage(msgId) {
    const isMod = isAdmin || (activeLive && user && activeLive.user_id === user.id);
    const { error } = await deleteChatMessage(msgId, isMod, user.id);
    if (error) { toast.error(error.message || 'Erro ao deletar'); return; }
    logAudit('live_chat_delete', `@${profile?.username} deletou uma mensagem no chat da live "${activeLive?.title}"`, { category: 'live' });
  }

  async function endLive() {
    if (!activeLive) return;
    await endLivePost(activeLive.id);
    logAudit('live_ended', `@${profile?.username} encerrou a live "${activeLive.title}"`, { category: 'live' });
    setLiveEnded(true);
  }

  async function handleSilenceUser(userId, minutes) {
    if (!activeLive) return;
    setSilencingUser(userId);
    setSilenceMenu(null);
    const { error } = await silenceUser({ postId: activeLive.id, userId, minutes, createdBy: user.id });
    if (error) {
      toast.error('Erro ao silenciar');
    } else {
      toast.success('Usuário silenciado por ' + minutes + ' min');
      logAudit('live_silence', `@${profile?.username} silenciou um usuário por ${minutes}min na live "${activeLive.title}"`, { category: 'live' });
    }
    setSilencingUser(null);
    await fetchTimeouts(activeLive.id);
  }

  async function handleUnsilenceUser(userId) {
    if (!activeLive) return;
    await unsilenceUser({ postId: activeLive.id, userId });
    logAudit('live_unsilence', `@${profile?.username} removeu silêncio na live "${activeLive.title}"`, { category: 'live' });
    await fetchTimeouts(activeLive.id);
  }

  const isUserSilenced = uid => !!isActive(timeouts[uid]);
  const silencedList = Object.values(timeouts).filter(isActive);
  const uniqueChatters = [...new Map(messages.map(m => [m.user_id, m.profiles])).values()];

  return {
    messages, msg, setMsg, sending, isSilenced, liveEnded, viewerCount,
    silenceMenu, setSilenceMenu, silencingUser,
    bottomRef, chatInputRef,
    sendMessage, deleteMessage, endLive, handleSilenceUser, handleUnsilenceUser,
    isUserSilenced, silencedList, uniqueChatters,
  };
}
