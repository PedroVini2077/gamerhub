import { useState } from 'react';
import { Shield, Clock, VolumeX, Tv, RotateCcw } from 'lucide-react';

export default function LivesPanel({
  liveMod, refreshing, fetchLiveMod,
  unsilenceUser, handleEndLive, setReactivateModal, isSuperAdmin,
}) {
  const [spinning, setSpinning] = useState(false);
  async function handleRefresh() {
    setSpinning(true);
    await Promise.all([fetchLiveMod(), new Promise(r => setTimeout(r, 500))]);
    setSpinning(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-neon-green" />
          <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">Moderação de Lives</h3>
        </div>
        <button onClick={handleRefresh} disabled={spinning || refreshing}
          className="text-xs font-mono text-gray-500 hover:text-neon-green transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <RotateCcw size={11} className={spinning || refreshing ? 'animate-spin' : ''} />
          {spinning || refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Silenciados */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={13} className="text-yellow-400" />
          <p className="text-xs font-mono text-yellow-400 uppercase tracking-wider font-bold">
            Usuários Silenciados ({liveMod.silenced?.length || 0})
          </p>
        </div>
        {!liveMod.silenced?.length ? (
          <p className="text-xs text-gray-600 font-mono">Nenhum usuário silenciado</p>
        ) : (
          <div className="space-y-2">
            {liveMod.silenced.map(t => {
              const remaining = Math.ceil((new Date(t.expires_at) - new Date()) / 60000);
              const live = liveMod.lives?.find(l => l.id === t.post_id);
              if (remaining <= 0) return null;
              return (
                <div key={t.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-yellow-400/10">
                  <VolumeX size={15} className="text-yellow-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-yellow-400">{t.profiles?.username}</p>
                    <p className="text-xs font-mono text-gray-600">
                      {live ? `Live: ${live.title}` : 'Live desconhecida'} · {remaining} min restantes
                    </p>
                  </div>
                  <button onClick={() => unsilenceUser(t.id)}
                    className="text-xs font-mono text-gray-500 hover:text-neon-green border border-dark-400 hover:border-neon-green/40 px-2 py-0.5 rounded transition-all">
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lives ativas */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-xs font-mono text-red-400 uppercase tracking-wider font-bold">
            Lives Ativas ({liveMod.lives?.length || 0})
          </p>
        </div>
        {!liveMod.lives?.length ? (
          <p className="text-xs text-gray-600 font-mono">Nenhuma live ativa</p>
        ) : (
          <div className="space-y-2">
            {liveMod.lives.map(l => (
              <div key={l.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-red-400/10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-white">{l.title}</p>
                  <p className="text-xs font-mono text-gray-600">por {l.profiles?.username}</p>
                </div>
                <button onClick={() => handleEndLive(l.id, l.title)}
                  className="text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/50 px-2 py-0.5 rounded transition-all shrink-0">
                  Encerrar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lives encerradas recentemente */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw size={13} className="text-neon-green/60" />
          <p className="text-xs font-mono text-neon-green/60 uppercase tracking-wider font-bold">
            Lives Encerradas — últimos 7 dias ({liveMod.endedLives?.length || 0})
          </p>
        </div>
        {!liveMod.endedLives?.length ? (
          <p className="text-xs text-gray-600 font-mono">Nenhuma live encerrada recentemente</p>
        ) : (
          <div className="space-y-2">
            {liveMod.endedLives.map(l => {
              const hasPending = liveMod.requests?.some(r => r.post_id === l.id);
              return (
                <div key={l.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
                  <Tv size={14} className="text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-white truncate">{l.title}</p>
                    <p className="text-xs font-mono text-gray-600">
                      por {l.profiles?.username} · {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {hasPending ? (
                    <span className="text-xs font-mono text-yellow-400/70 border border-yellow-400/20 px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                      <Clock size={10} />Aguardando
                    </span>
                  ) : (
                    <button onClick={() => setReactivateModal(l)}
                      className="flex items-center gap-1 text-xs font-mono text-neon-green/70 hover:text-neon-green border border-neon-green/20 hover:border-neon-green/50 px-2 py-0.5 rounded transition-all shrink-0">
                      <RotateCcw size={10} />
                      {isSuperAdmin ? 'Reativar' : 'Solicitar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
