import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchReports, updateReportStatus } from '../../services/moderationService';

const STATUS_COLOR = { pending: 'tag-purple', reviewed: 'tag-cyan', dismissed: 'text-gray-600 border border-dark-500 bg-dark-700 px-2 py-0.5 rounded text-xs font-mono' };
const REASON_LABEL = {
  spam: 'Spam', hate: 'Discurso de ódio', nsfw: 'Conteúdo adulto',
  harassment: 'Assédio', misinformation: 'Desinformação', other: 'Outro',
};

export default function ReportsList() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', statusFilter],
    queryFn: () => fetchReports({ status: statusFilter || null }),
  });

  async function handleDismiss(id) {
    const { error } = await updateReportStatus(id, 'dismissed');
    if (error) toast.error('Erro ao dispensar');
    else { toast.success('Denúncia dispensada'); qc.invalidateQueries({ queryKey: ['reports'] }); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['pending', 'reviewed', 'dismissed', ''].map(s => (
          <button key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              statusFilter === s
                ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                : 'border-dark-500 text-gray-500 hover:text-gray-300'
            }`}>
            {s === 'pending' ? 'Pendentes' : s === 'reviewed' ? 'Revisadas' : s === 'dismissed' ? 'Dispensadas' : 'Todas'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-dark-700 rounded animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <div className="card p-10 text-center">
          <Flag size={28} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm font-mono text-gray-500">Nenhuma denúncia aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="card p-3 flex items-start gap-3">
              <Flag size={13} className="text-orange-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-white">{REASON_LABEL[r.reason] || r.reason}</span>
                  <span className={`tag ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                  <span className="text-xs font-mono text-gray-500">{r.content_type} · {r.content_id?.slice(0,8)}...</span>
                </div>
                {r.details && <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{r.details}</p>}
                <p className="text-xs font-mono text-gray-600 mt-0.5">
                  @{r.reporter?.username || '?'} · {new Date(r.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              {r.status === 'pending' && (
                <button onClick={() => handleDismiss(r.id)}
                  className="shrink-0 text-xs font-mono text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors">
                  <CheckCircle size={12} /> Dispensar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
