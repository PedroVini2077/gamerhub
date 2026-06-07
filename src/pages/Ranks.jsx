import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth.jsx';
import { RANK_TIERS, XP_SOURCES, getRankFromXP, getRankLabel, getSubRankProgress, ROMAN, OWNER_RANK } from '../lib/ranks';

export default function Ranks() {
  const { user } = useAuth();

  const { data: xpData, isLoading: loading } = useQuery({
    queryKey: ['user_xp', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_xp', { p_user_id: user.id });
      return data ?? null;
    },
    enabled: !!user,
  });

  const myRank     = xpData ? getRankFromXP(xpData.xp) : null;
  const myProgress = xpData ? getSubRankProgress(xpData.xp) : null;
  const MyRankIcon = myRank?.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="card p-5 border-yellow-400/20" style={{ boxShadow: '0 0 30px #eab30810' }}>
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={16} className="text-yellow-400" />
          <h1 className="font-display text-sm text-yellow-400 tracking-widest uppercase">
            Sistema de Ranks
          </h1>
        </div>
        <p className="text-xs font-mono text-gray-500">
          Ganhe XP jogando, postando e completando seu perfil. Suba de rank e mostre quem é o melhor.
        </p>
      </div>

      {/* Card do próprio rank (se logado) */}
      {user && (
        <div className="card p-5"
          style={myRank ? { borderColor: `${myRank.color}30`, boxShadow: `0 0 30px ${myRank.glow}` } : {}}>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Seu Rank Atual</p>
          {loading ? (
            <div className="flex gap-3 items-center animate-pulse">
              <div className="w-12 h-12 rounded-full bg-dark-500" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-dark-500 rounded w-1/3" />
                <div className="h-2 bg-dark-500 rounded w-1/2" />
              </div>
            </div>
          ) : myRank ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: `${myRank.borderWidth}px solid ${myRank.color}`, background: `${myRank.color}10`, boxShadow: `0 0 14px ${myRank.glow}` }}>
                  {MyRankIcon && <MyRankIcon size={22} style={{ color: myRank.color }} />}
                </div>
                <div>
                  <p className="font-display text-lg font-bold" style={{ color: myRank.color }}>
                    {getRankLabel(myRank)}
                  </p>
                  <p className="text-xs font-mono text-gray-500">{xpData.xp} XP total</p>
                </div>
              </div>

              {myProgress?.needed != null ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-gray-500">
                    <span>{myProgress.current} / {myProgress.needed} XP neste sub-rank</span>
                    <span>{myProgress.pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-dark-500 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${myProgress.pct}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                      style={{ background: myRank.color, boxShadow: `0 0 8px ${myRank.glow}` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs font-mono" style={{ color: myRank.color }}>
                  Rank máximo atingido — você é lendário! 👑
                </p>
              )}

              {/* Breakdown de XP */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: 'Posts',          value: xpData.posts,         xp: xpData.posts * 20 },
                  { label: 'Likes recebidos',value: xpData.likes,         xp: xpData.likes * 5  },
                  { label: 'Comentários',    value: xpData.comments,      xp: xpData.comments * 3 },
                  { label: 'Bônus de perfil',value: null,                 xp: xpData.profile_bonus },
                ].map(item => (
                  <div key={item.label} className="bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
                    <p className="text-xs text-gray-500 font-mono">{item.label}</p>
                    <p className="text-sm font-mono font-bold text-white">
                      +{item.xp} XP
                      {item.value != null && <span className="text-gray-600 font-normal"> · {item.value}x</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-gray-500">Erro ao carregar XP.</p>
          )}
        </div>
      )}

      {!user && (
        <div className="card p-5 text-center space-y-2">
          <p className="text-sm font-mono text-gray-400">Faça login para ver seu rank</p>
          <Link to="/login" className="btn-solid py-2 px-5 text-xs inline-block">Entrar</Link>
        </div>
      )}

      {/* Tier especial — Fundador */}
      <div className="space-y-3">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider px-1">Todos os Ranks</p>

        <div className="card p-4 space-y-2"
          style={{ borderColor: `${OWNER_RANK.color}40`, boxShadow: `0 0 25px ${OWNER_RANK.glow}` }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: `${OWNER_RANK.color}20`, color: OWNER_RANK.color }}>
              TIER EXCLUSIVO
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ border: `3px solid ${OWNER_RANK.color}`, background: `${OWNER_RANK.color}12`, boxShadow: `0 0 14px ${OWNER_RANK.glow}` }}>
              <OWNER_RANK.icon size={18} style={{ color: OWNER_RANK.color }} />
            </div>
            <div>
              <p className="font-display font-bold text-sm" style={{ color: OWNER_RANK.color }}>
                Fundador
              </p>
              <p className="text-xs font-mono text-gray-500">Criador da plataforma · rank único, não obtido por XP</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ranks por XP */}
      <div className="space-y-3">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider px-1">Ranks por XP</p>
        {RANK_TIERS.map(tier => {
          const TierIcon = tier.icon;
          const isCurrentTier = myRank?.tier === tier.tier;

          return (
            <div key={tier.tier} className="card p-4 space-y-3"
              style={isCurrentTier ? { borderColor: `${tier.color}40`, boxShadow: `0 0 20px ${tier.glow}` } : {}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ border: `${tier.borderWidth}px solid ${tier.color}`, background: `${tier.color}10` }}>
                  <TierIcon size={18} style={{ color: tier.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm" style={{ color: tier.color }}>
                      {tier.label}
                    </span>
                    {isCurrentTier && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${tier.color}20`, color: tier.color }}>
                        você está aqui
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-gray-500">
                    {tier.maxXP === Infinity ? `${tier.minXP}+ XP` : `${tier.minXP} – ${tier.maxXP} XP`}
                  </p>
                </div>
              </div>

              {/* Sub-ranks */}
              {tier.subRanks > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: tier.subRanks }, (_, i) => {
                    const subN = i + 1;
                    const range = tier.maxXP - tier.minXP + 1;
                    const perSub = range / tier.subRanks;
                    const subMin = Math.floor(tier.minXP + i * perSub);
                    const subMax = Math.floor(tier.minXP + (i + 1) * perSub) - 1;
                    const isHere = isCurrentTier && myRank?.subRank === subN;
                    return (
                      <div key={subN}
                        className="flex-1 min-w-[60px] rounded-lg px-2 py-2 text-center border transition-all"
                        style={isHere
                          ? { borderColor: `${tier.color}60`, background: `${tier.color}15` }
                          : { borderColor: '#2e2e3e', background: 'transparent' }}>
                        <p className="text-xs font-display font-bold" style={{ color: isHere ? tier.color : '#6b7280' }}>
                          {ROMAN[subN]}
                        </p>
                        <p className="font-mono" style={{ fontSize: 9, color: '#4b5563' }}>
                          {subMin}–{subMax}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Como ganhar XP */}
      <div className="card p-5 space-y-3">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Como Ganhar XP</p>
        <div className="space-y-1.5">
          {XP_SOURCES.map((src, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
              <div className="flex items-center gap-2">
                <src.icon size={15} className="shrink-0"
                  style={{ color: src.color || '#6b7280' }} />
                <span className="text-xs font-mono text-gray-300">{src.label}</span>
                {src.oneTime && (
                  <span className="text-xs font-mono text-gray-600 bg-dark-600 px-1.5 py-0.5 rounded">
                    único
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-yellow-400">+{src.xp} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
