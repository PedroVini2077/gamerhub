import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, Crown, ArrowRight } from 'lucide-react';
import { getRankLabel } from '../../lib/ranks';

/** Posts / likes / XP e o bloco de rank com barra de progresso. */
export default function PlayerStatsCard({ stats, xpData, rank, progress, nextTier, isOwner }) {
  const RankIcon = rank?.icon;
  const cells = [
    { label: 'Posts', value: stats.posts,        color: 'text-neon-green' },
    { label: 'Likes', value: stats.likes,        color: 'text-neon-purple' },
    { label: 'XP',    value: xpData?.xp ?? '—',  color: 'text-yellow-400' },
  ];

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
        <Trophy size={12} />Stats do Jogador
      </h3>

      <div className="grid grid-cols-3 gap-3 text-center">
        {cells.map(s => (
          <div key={s.label} className="bg-dark-700 rounded p-3 border border-dark-400">
            <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-mono">{s.label}</p>
          </div>
        ))}
      </div>

      {rank && (
        <div className="bg-dark-700 rounded-lg p-3 border border-dark-400 space-y-2"
          style={isOwner ? { borderColor: `${rank.color}30`, boxShadow: `0 0 12px ${rank.glow}` } : {}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {RankIcon && <RankIcon size={13} style={{ color: rank.color }} />}
              <span className="text-sm font-display font-bold" style={{ color: rank.color }}>
                {isOwner ? 'Fundador — Criador da plataforma' : getRankLabel(rank)}
              </span>
            </div>
            {!isOwner && (
              <Link to="/ranks" className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">
                ver todos <ArrowRight size={11} className="inline align-[-1px]" />
              </Link>
            )}
          </div>

          {!isOwner && progress && (
            progress.needed != null ? (
              <>
                <div className="w-full h-1.5 bg-dark-500 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                    style={{ background: rank.color, boxShadow: `0 0 6px ${rank.glow}` }}
                  />
                </div>
                <p className="text-xs font-mono text-gray-500">
                  {progress.current} / {progress.needed} XP
                  {nextTier && rank.subRank === rank.subRanks && (
                    <span className="text-gray-600"> · próximo: {nextTier.label}</span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-xs font-mono flex items-center gap-1" style={{ color: rank.color }}>
                <Crown size={11} /> Rank máximo atingido!
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
