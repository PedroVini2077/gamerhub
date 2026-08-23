import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
  fetchModerationQueue, resolveQueueItem, fetchReports,
  updateReportStatus, addViolation, applySuspension, hideContent,
} from '../../services/moderationService';
import { deleteChatMessage } from '../../services/liveService';
import BanModal from '../ui/BanModal';
import QueueItemCard from './QueueItemCard';
import { CONTENT_LABEL, TRIGGER_LABEL, ACTION_POINTS, podeSerOcultado, TABELA_DO_AUTOR } from './queueLabels';
import { logAudit } from '../../lib/auditLog';
import { useAuth } from '../../hooks/useAuth.jsx';

const PAGE_SIZE = 20;


export default function ModerationQueue() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState({});
  const [actions, setActions] = useState({});
  const [banTarget, setBanTarget] = useState(null);
  const [resolving, setResolving] = useState(new Set());

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    const { data: { items: data, count } = {} } = await fetchModerationQueue('pending', p, PAGE_SIZE);
    setItems(data);
    setTotalCount(count);

    const ids = data.map(i => i.content_id);
    if (ids.length > 0) {
      const { data: reps } = await fetchReports({ status: 'pending' });
      const grouped = {};
      ids.forEach(id => { grouped[id] = reps.filter(r => r.content_id === id); });
      setReports(grouped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    const channel = supabase
      .channel('moderation_queue_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moderation_queue' }, () => {
        load(0);
        setPage(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Confirmar um item: ocultar o conteúdo (ou APAGAR, se for chat, que não tem
  // como ser ocultado). Devolve mensagem de erro, ou null se deu certo.
  async function aplicarOcultacao(item) {
    if (podeSerOcultado(item.content_type)) {
      const { error } = await hideContent(item.content_type, item.content_id);
      return error?.message ?? null;
    }
    // `isMod = true`: quem chega aqui já está no painel de moderação. A RLS de
    // `live_chat` ainda decide de verdade (autor, dono da live ou hierarquia),
    // e `deleteChatMessage` trata 0 linhas como falha.
    const { error } = await deleteChatMessage(item.content_id, true, profile?.id);
    return error?.message ?? null;
  }

  async function buscarAutor(item) {
    const tabela = TABELA_DO_AUTOR[item.content_type];
    if (!tabela) return null;
    const { data } = await supabase.from(tabela).select('user_id').eq('id', item.content_id).maybeSingle();
    return data?.user_id ?? null;
  }

  async function handleResolve(item, decision) {
    if (resolving.has(item.id)) return;
    setResolving(s => new Set([...s, item.id]));
    try {
      // O autor é lido ANTES de resolver: se a decisão apaga a mensagem de
      // chat, depois não há mais linha de onde tirar o `user_id` — e a violação
      // ficaria sem dono, justamente no caso que mais precisa dela.
      const authorId = await buscarAutor(item);

      const { error } = await resolveQueueItem(item.id, decision, item.content_type, item.content_id);
      if (error) { toast.error(error.message || 'Erro ao resolver item'); return; }

      if (decision === 'approved') {
        // O erro daqui era DESCARTADO. `hideContent` usa `count: 'exact'`
        // justamente para detectar a RLS negando em silêncio — jogar a resposta
        // fora anulava essa proteção: a fila marcava "resolvido" e o conteúdo
        // continuava visível no site.
        const falha = await aplicarOcultacao(item);
        if (falha) {
          toast.error(podeSerOcultado(item.content_type)
            ? 'Item resolvido, mas NÃO foi possível ocultar: ' + falha
            : 'Item resolvido, mas NÃO foi possível apagar a mensagem: ' + falha);
        }
      }

      const reps = reports[item.content_id] || [];
      const resultados = await Promise.all(
        reps.map(r => updateReportStatus(r.id, decision === 'approved' ? 'reviewed' : 'dismissed')),
      );
      const falhas = resultados.filter(r => r.error).length;
      if (falhas) toast.error(`${falhas} denúncia(s) não puderam ser atualizadas.`);

      if (authorId) {
        const action = actions[item.id];
        if (decision === 'approved' && action) {
          // Sem checar o erro, a violação some e o usuário nunca acumula
          // pontos rumo à escalação automática — a punição simplesmente não
          // acontece, sem ninguém ficar sabendo.
          const { error: violErr } = await addViolation({
            userId: authorId,
            contentType: item.content_type,
            contentId: item.content_id,
            reason: reps[0]?.reason || 'moderação manual',
            actionTaken: action,
            points: ACTION_POINTS[action] ?? 1,
          });
          if (violErr) toast.error('Falha ao registrar a violação: ' + violErr.message);
          if (action === 'suspend_1d' || action === 'suspend_7d') {
            const { error: suspErr } = await applySuspension(authorId, action === 'suspend_7d' ? 7 : 1);
            if (suspErr) toast.error('Violação criada, mas falha ao suspender: ' + suspErr.message);
          }
        }

        // Notifica o autor (via RPC — tabela não tem INSERT policy)
        if (decision === 'approved') {
          const label = CONTENT_LABEL[item.content_type]?.toLowerCase() || 'conteúdo';
          await supabase.rpc('notify_user', {
            p_user_id: authorId,
            p_type: 'moderation',
            p_message: podeSerOcultado(item.content_type)
              ? `Seu ${label} foi ocultado pela moderação por violar as regras da comunidade.`
              : 'Sua mensagem no chat da live foi apagada pela moderação por violar as regras da comunidade.',
          });
        }
      }

      // Decisão de moderação é ação de admin com consequência (conteúdo some ou
      // volta, autor leva pontos de infração) e não constava em lugar nenhum da
      // auditoria — só no status da própria fila.
      logAudit(
        decision === 'approved' ? 'moderation_approved' : 'moderation_rejected',
        `@${profile?.username} ${decision === 'approved' ? 'confirmou a ocultação' : 'restaurou'} ` +
        `${CONTENT_LABEL[item.content_type]?.toLowerCase() || 'conteúdo'} ` +
        `(motivo da fila: ${TRIGGER_LABEL[item.trigger_type] || item.trigger_type || '—'})`,
        {
          category: 'admin',
          severity: decision === 'approved' ? 'warning' : 'info',
          metadata: {
            content_type: item.content_type,
            content_id: item.content_id,
            decision,
            action: actions[item.id] || null,
          },
        });

      toast.success(decision === 'approved'
        ? (podeSerOcultado(item.content_type) ? 'Ocultação confirmada' : 'Mensagem apagada')
        : 'Item resolvido');
      load(page);
    } finally {
      setResolving(s => { const n = new Set(s); n.delete(item.id); return n; });
    }
  }

  async function handleBan(item) {
    const tabela = TABELA_DO_AUTOR[item.content_type];
    if (!tabela) return;
    const { data } = await supabase
      .from(tabela)
      .select('user_id, profiles(username, role, avatar_url, bio, created_at)')
      .eq('id', item.content_id).maybeSingle();
    if (data) setBanTarget({ id: data.user_id, ...data.profiles });
    else toast.error('Conteúdo não existe mais — não dá para identificar o autor.');
  }

  if (loading && items.length === 0) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-36 bg-dark-700 rounded-xl animate-pulse" />)}
    </div>
  );

  if (items.length === 0) return (
    <div className="card p-10 text-center">
      <CheckCircle size={32} className="text-neon-green mx-auto mb-3 opacity-50" />
      <p className="text-sm font-mono text-gray-500">Fila vazia — nenhum item pendente.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {banTarget && (
        <BanModal target={banTarget} onClose={() => setBanTarget(null)}
          onBanned={() => { setBanTarget(null); load(page); }} />
      )}

      {items.map(item => (
        <QueueItemCard
          key={item.id}
          item={item}
          reports={reports[item.content_id] || []}
          action={actions[item.id] || ''}
          onActionChange={v => setActions(a => ({ ...a, [item.id]: v }))}
          isResolving={resolving.has(item.id)}
          onResolve={decision => handleResolve(item, decision)}
          onBan={() => handleBan(item)}
        />
      ))}

      {(page > 0 || totalCount > PAGE_SIZE) && (
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 pt-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 border border-dark-400 rounded hover:text-white disabled:opacity-40 transition-all">
            <ChevronLeft size={13} /> Anterior
          </button>
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 border border-dark-400 rounded hover:text-white disabled:opacity-40 transition-all">
            Próxima <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
