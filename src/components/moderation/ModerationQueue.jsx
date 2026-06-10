import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, ShieldAlert, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
  fetchModerationQueue, resolveQueueItem, fetchReports,
  updateReportStatus, addViolation, applySuspension, hideContent,
} from '../../services/moderationService';
import BanModal from '../ui/BanModal';

const CONTENT_LABEL = { post: 'Post', comment: 'Comentário', mural: 'Mural', chat: 'Chat' };
const TRIGGER_LABEL  = { report: 'Denúncias', wordlist: 'Palavrão', ai: 'IA', escalation: 'Escalação' };
const TRIGGER_COLOR  = { report: 'text-orange-400', wordlist: 'text-yellow-400', ai: 'text-purple-400', escalation: 'text-red-400' };

const ACTION_POINTS = { warn: 1, hide: 2, suspend_1d: 5, suspend_7d: 10 };

function ContentPreview({ contentType, contentId }) {
  const [content, setContent] = useState(null);

  useEffect(() => {
    async function load() {
      const table = contentType === 'post' ? 'posts'
        : contentType === 'comment' ? 'comments'
        : 'community_posts';
      const textCol = contentType === 'mural' ? 'message' : contentType === 'post' ? 'title' : 'content';
      const { data } = await supabase
        .from(table)
        .select(`id, ${textCol}, user_id, profiles(username)`)
        .eq('id', contentId)
        .single();
      setContent(data);
    }
    load();
  }, [contentType, contentId]);

  if (!content) return <p className="text-xs font-mono text-gray-600 italic">Carregando...</p>;
  const text = content.title || content.content || content.message || '';
  return (
    <div className="bg-dark-700 rounded-lg p-3 space-y-1">
      <p className="text-xs font-mono text-gray-500">
        @{content.profiles?.username || '?'} · {CONTENT_LABEL[contentType]}
      </p>
      <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed">{text || '(sem texto)'}</p>
    </div>
  );
}

function ActionSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="bg-dark-700 border border-dark-500 text-xs font-mono text-gray-300 rounded px-2 py-1.5 w-full">
      <option value="">Selecionar ação...</option>
      <option value="warn">Aviso (+1pt)</option>
      <option value="hide">Ocultar conteúdo (+2pt)</option>
      <option value="suspend_1d">Suspender 1 dia (+5pt)</option>
      <option value="suspend_7d">Suspender 7 dias (+10pt)</option>
    </select>
  );
}

export default function ModerationQueue() {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState({});
  const [actions, setActions] = useState({});
  const [banTarget, setBanTarget] = useState(null);
  const PAGE_SIZE = 20;

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    const { items: data, count } = await fetchModerationQueue('pending', p, PAGE_SIZE);
    setItems(data);
    setTotalCount(count);

    // Busca relatórios agrupados por content_id
    const ids = data.map(i => i.content_id);
    if (ids.length > 0) {
      const reps = await fetchReports({ status: 'pending' });
      const grouped = {};
      ids.forEach(id => { grouped[id] = reps.filter(r => r.content_id === id); });
      setReports(grouped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  async function handleResolve(item, decision) {
    const { error } = await resolveQueueItem(item.id, decision, item.content_type, item.content_id);
    if (error) { toast.error('Erro ao resolver item'); return; }

    // Garante a ocultação ao confirmar (idempotente). Hoje o gatilho 'report' já
    // oculta automático, mas itens de wordlist/IA entram na fila sem ocultar —
    // assim "Confirmar ocultação" funciona independente de como foi enfileirado.
    if (decision === 'approved' && item.content_type !== 'chat') {
      await hideContent(item.content_type, item.content_id);
    }

    // Marca todos os reports deste conteúdo como revisados
    const reps = reports[item.content_id] || [];
    await Promise.all(reps.map(r => updateReportStatus(r.id, decision === 'approved' ? 'reviewed' : 'dismissed')));

    // Se aprovado (mantém oculto) + ação selecionada → cria violação (e suspende, se for o caso)
    const action = actions[item.id];
    if (decision === 'approved' && action) {
      const table = item.content_type === 'post' ? 'posts'
        : item.content_type === 'comment' ? 'comments' : 'community_posts';
      const { data } = await supabase.from(table).select('user_id').eq('id', item.content_id).single();
      const userId = data?.user_id;

      if (userId) {
        await addViolation({
          userId,
          contentType: item.content_type,
          contentId: item.content_id,
          reason: reps[0]?.reason || 'moderação manual',
          actionTaken: action,
          points: ACTION_POINTS[action] ?? 1,
        });
        // Materializa a suspensão temporária real (RLS bloqueia criar conteúdo)
        if (action === 'suspend_1d' || action === 'suspend_7d') {
          const { error: suspErr } = await applySuspension(userId, action === 'suspend_7d' ? 7 : 1);
          if (suspErr) toast.error('Violação criada, mas falha ao suspender: ' + suspErr.message);
        }
      }
    }

    toast.success(decision === 'approved' ? 'Ocultação confirmada' : 'Conteúdo restaurado');
    load(page);
  }

  async function getContentUserId(item) {
    const table = item.content_type === 'post' ? 'posts'
      : item.content_type === 'comment' ? 'comments'
      : 'community_posts';
    const { data } = await supabase.from(table).select('user_id, profiles(username, role, avatar_url, bio, created_at)').eq('id', item.content_id).single();
    return data;
  }

  async function handleBan(item) {
    const data = await getContentUserId(item);
    if (data) setBanTarget({ id: data.user_id, ...data.profiles });
  }

  if (loading && items.length === 0) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-36 bg-dark-700 rounded-xl animate-pulse" />)}
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
      {banTarget && <BanModal target={banTarget} onClose={() => setBanTarget(null)} onBanned={() => { setBanTarget(null); load(page); }} />}

      {items.map(item => {
        const reps = reports[item.content_id] || [];
        return (
          <div key={item.id} className="card p-4 border-orange-500/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} className={TRIGGER_COLOR[item.trigger_type] || 'text-gray-400'} />
                <span className={`text-xs font-mono font-bold ${TRIGGER_COLOR[item.trigger_type]}`}>
                  {TRIGGER_LABEL[item.trigger_type]}
                </span>
                <span className="tag tag-cyan text-xs">{CONTENT_LABEL[item.content_type]}</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono text-gray-500">
                <Clock size={10} />
                {new Date(item.created_at).toLocaleString('pt-BR')}
              </div>
            </div>

            <ContentPreview contentType={item.content_type} contentId={item.content_id} />

            {reps.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-mono text-gray-500">{reps.length} denúncia(s):</p>
                {reps.slice(0, 3).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span className="text-orange-400">⚑</span>
                    {r.reason}
                    {r.details && <span className="text-gray-600">— {r.details}</span>}
                  </div>
                ))}
              </div>
            )}

            <ActionSelect
              value={actions[item.id] || ''}
              onChange={v => setActions(a => ({ ...a, [item.id]: v }))}
            />

            <div className="flex gap-2">
              <button onClick={() => handleResolve(item, 'approved')}
                className="flex-1 py-2 text-xs font-mono font-bold rounded flex items-center justify-center gap-1.5 transition-all"
                style={{ background: '#ef444415', color: '#f87171', border: '1px solid #ef444440' }}>
                <CheckCircle size={12} /> Confirmar ocultação
              </button>
              <button onClick={() => handleResolve(item, 'rejected')}
                className="flex-1 py-2 text-xs font-mono rounded flex items-center justify-center gap-1.5 transition-all"
                style={{ background: '#22c55e15', color: '#4ade80', border: '1px solid #22c55e40' }}>
                <XCircle size={12} /> Restaurar
              </button>
              <button onClick={() => handleBan(item)}
                className="px-3 py-2 text-xs font-mono rounded flex items-center gap-1.5 transition-all"
                style={{ background: '#7c3aed15', color: '#a78bfa', border: '1px solid #7c3aed40' }}>
                <UserX size={12} /> Banir
              </button>
            </div>
          </div>
        );
      })}

      {(page > 0 || totalCount > PAGE_SIZE) && (
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 pt-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 border border-dark-400 rounded hover:text-white disabled:opacity-40 transition-all">
            ← Anterior
          </button>
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 border border-dark-400 rounded hover:text-white disabled:opacity-40 transition-all">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
