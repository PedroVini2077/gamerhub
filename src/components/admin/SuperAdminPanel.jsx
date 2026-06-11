import { useState } from 'react';
import { Crown, Lock, RotateCcw, CheckCircle, XCircle, Shield } from 'lucide-react';

export default function SuperAdminPanel({
  blockedLogins, blockedLoading, fetchBlockedLogins, setUnlockModal,
  unbanRequests, unbanReqLoading, fetchUnbanRequests, setDenyUnbanModal, handleApproveUnban, pendingUnbanCount,
  liveMod, refreshing, fetchLiveMod, handleApproveRequest, handleDenyRequest,
}) {
  const [spinBlocked, setSpinBlocked] = useState(false);
  const [spinUnban, setSpinUnban]     = useState(false);
  const [spinLive, setSpinLive]       = useState(false);

  async function refreshBlocked() {
    setSpinBlocked(true);
    await Promise.all([fetchBlockedLogins(), new Promise(r => setTimeout(r, 500))]);
    setSpinBlocked(false);
  }
  async function refreshUnban() {
    setSpinUnban(true);
    await Promise.all([fetchUnbanRequests(), new Promise(r => setTimeout(r, 500))]);
    setSpinUnban(false);
  }
  async function refreshLive() {
    setSpinLive(true);
    await Promise.all([fetchLiveMod(), new Promise(r => setTimeout(r, 500))]);
    setSpinLive(false);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 border-yellow-400/20" style={{ boxShadow: '0 0 20px #eab30810' }}>
        <div className="flex items-center gap-2">
          <Crown size={14} className="text-yellow-400" />
          <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Área Super Admin</h3>
        </div>
        <p className="text-xs text-gray-600 font-mono mt-1">Acesso exclusivo — super admins only.</p>
      </div>

      {/* Usuários Bloqueados */}
      <div className="card p-4 border-red-500/20" style={{ boxShadow: '0 0 20px #ef444415' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-red-400" />
            <h3 className="font-display text-sm text-red-400 uppercase tracking-wider">Usuários Bloqueados</h3>
          </div>
          <button onClick={refreshBlocked} disabled={spinBlocked || blockedLoading}
            className="text-xs text-gray-500 hover:text-neon-green font-mono transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw size={11} className={spinBlocked || blockedLoading ? 'animate-spin' : ''} />
            {spinBlocked || blockedLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        {blockedLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded-lg animate-pulse" />)}
          </div>
        ) : blockedLogins.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle size={24} className="text-neon-green/40 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-mono">Nenhum usuário bloqueado no momento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blockedLogins.map(entry => (
              <div key={entry.email}
                className={`bg-dark-700 rounded-lg p-3 border flex items-center justify-between gap-2 ${
                  entry.permanent ? 'border-red-600/30' : 'border-red-500/10'
                }`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono text-white truncate">{entry.email}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                    {entry.username && <span className="text-xs text-gray-400 font-mono">@{entry.username}</span>}
                    <span className="text-xs text-red-400 font-mono">{entry.attempts} tentativas</span>
                    {entry.permanent ? (
                      <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>permanente</span>
                    ) : (
                      <span className="text-xs text-orange-400 font-mono">
                        bloqueado até {new Date(entry.blocked_until).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setUnlockModal(entry)}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-mono text-neon-green border border-neon-green/30 hover:bg-neon-green/10 px-3 py-1.5 rounded transition-all">
                  Desbloquear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitações de desbanimento */}
      <div className="card p-4 border-yellow-400/20" style={{ boxShadow: '0 0 20px #eab30810' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-yellow-400" />
            <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Solicitações de Desbanimento</h3>
            {pendingUnbanCount > 0 && (
              <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>{pendingUnbanCount}</span>
            )}
          </div>
          <button onClick={refreshUnban} disabled={spinUnban || unbanReqLoading}
            className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw size={11} className={spinUnban || unbanReqLoading ? 'animate-spin' : ''} />
            {spinUnban || unbanReqLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        {unbanReqLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-dark-700 rounded-lg animate-pulse" />)}
          </div>
        ) : unbanRequests.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle size={24} className="text-neon-green/40 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-mono">Nenhuma solicitação pendente</p>
          </div>
        ) : unbanRequests.map(req => (
          <div key={req.id} className="bg-dark-700 rounded-lg p-3 border border-yellow-400/10 space-y-2 mb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white font-bold">@{req.target_username}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  solicitado por <span className="text-yellow-400">@{req.requesting_admin_username}</span>
                  {' · '}{new Date(req.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <span className="tag tag-purple shrink-0" style={{ fontSize: 9 }}>pendente</span>
            </div>
            <div className="bg-dark-600 rounded px-3 py-2 border border-dark-500">
              <p className="text-xs font-mono text-gray-300 leading-relaxed">{req.reason}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleApproveUnban(req)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono font-bold text-neon-green border border-neon-green/30 rounded hover:bg-neon-green/10 transition-all">
                <CheckCircle size={12} /> Aprovar e Desbanir
              </button>
              <button onClick={() => setDenyUnbanModal(req)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-all">
                <XCircle size={12} /> Negar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Solicitações de reativação de live */}
      <div className="card p-4 border-yellow-400/20" style={{ boxShadow: '0 0 20px #eab30810' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-yellow-400" />
            <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Solicitações de Live</h3>
            {(liveMod.requests?.length || 0) > 0 && (
              <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>{liveMod.requests.length}</span>
            )}
          </div>
          <button onClick={refreshLive} disabled={spinLive || refreshing}
            className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw size={11} className={spinLive || refreshing ? 'animate-spin' : ''} />
            {spinLive || refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        {!liveMod.requests?.length ? (
          <div className="text-center py-4">
            <CheckCircle size={24} className="text-neon-green/40 mx-auto mb-2" />
            <p className="text-xs font-mono text-gray-500">Nenhuma solicitação de live pendente</p>
          </div>
        ) : liveMod.requests.map(req => (
          <div key={req.id} className="bg-dark-700 rounded-lg p-3 border border-yellow-400/10 space-y-3 mb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white font-mono truncate">"{req.post_title}"</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  por <span className="text-yellow-400">{req.admin_username}</span>
                  {' · '}{new Date(req.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <span className="tag tag-purple shrink-0 text-xs">pendente</span>
            </div>
            <div className="bg-dark-600 rounded-lg px-3 py-2 border border-dark-500">
              <p className="text-xs font-mono text-neon-green font-bold">{req.reason}</p>
              {req.details && <p className="text-xs font-mono text-gray-400 mt-0.5">{req.details}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleApproveRequest(req)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono font-bold text-neon-green border border-neon-green/30 rounded hover:bg-neon-green/10 transition-all">
                <CheckCircle size={12} /> Aprovar e Reativar
              </button>
              <button onClick={() => handleDenyRequest(req)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-all">
                <XCircle size={12} /> Negar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
