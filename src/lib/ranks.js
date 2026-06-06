import { Shield, Star, Swords, Zap, Target, Flame, Crown, Gem, FileText, Heart, MessageCircle, Tv, PenLine, Camera, Gamepad2, Hash, Radio, Play } from 'lucide-react';

export const RANK_TIERS = [
  {
    tier:      'recruta',
    label:     'Recruta',
    icon:      Shield,
    minXP:     0,
    maxXP:     199,
    subRanks:  4,
    color:     '#6b7280',
    glow:      'rgba(107,114,128,0.25)',
    textClass: 'text-gray-400',
    borderWidth: 1,
  },
  {
    tier:      'veterano',
    label:     'Veterano',
    icon:      Star,
    minXP:     200,
    maxXP:     499,
    subRanks:  4,
    color:     '#d1d5db',
    glow:      'rgba(209,213,219,0.3)',
    textClass: 'text-gray-300',
    borderWidth: 1,
  },
  {
    tier:      'guerreiro',
    label:     'Guerreiro',
    icon:      Swords,
    minXP:     500,
    maxXP:     999,
    subRanks:  4,
    color:     '#fbbf24',
    glow:      'rgba(251,191,36,0.3)',
    textClass: 'text-yellow-400',
    borderWidth: 2,
  },
  {
    tier:      'elite',
    label:     'Elite',
    icon:      Zap,
    minXP:     1000,
    maxXP:     1999,
    subRanks:  4,
    color:     '#22d3ee',
    glow:      'rgba(34,211,238,0.35)',
    textClass: 'text-cyan-400',
    borderWidth: 2,
  },
  {
    tier:      'predador',
    label:     'Predador',
    icon:      Target,
    minXP:     2000,
    maxXP:     3999,
    subRanks:  4,
    color:     '#a855f7',
    glow:      'rgba(168,85,247,0.4)',
    textClass: 'text-purple-400',
    borderWidth: 2,
  },
  {
    tier:      'lenda',
    label:     'Lenda',
    icon:      Flame,
    minXP:     4000,
    maxXP:     7999,
    subRanks:  1,
    color:     '#39ff14',
    glow:      'rgba(57,255,20,0.4)',
    textClass: 'text-neon-green',
    borderWidth: 2,
  },
  {
    tier:      'deus',
    label:     'Deus do Jogo',
    icon:      Crown,
    minXP:     8000,
    maxXP:     Infinity,
    subRanks:  1,
    color:     '#ef4444',
    glow:      'rgba(239,68,68,0.5)',
    textClass: 'text-red-400',
    borderWidth: 3,
  },
];

export const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

export function getRankFromXP(xp = 0) {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (xp >= RANK_TIERS[i].minXP) {
      const tier = RANK_TIERS[i];
      let subRank = 1;
      if (tier.subRanks > 1) {
        const range = tier.maxXP - tier.minXP + 1;
        const perSub = range / tier.subRanks;
        subRank = Math.min(tier.subRanks, Math.floor((xp - tier.minXP) / perSub) + 1);
      }
      return { ...tier, subRank };
    }
  }
  return { ...RANK_TIERS[0], subRank: 1 };
}

export function getRankLabel(rank) {
  if (!rank) return '—';
  if (rank.subRanks === 1) return rank.label;
  return `${rank.label} ${ROMAN[rank.subRank]}`;
}

// Retorna { current, needed, pct } dentro do sub-rank atual
export function getSubRankProgress(xp = 0) {
  const rank = getRankFromXP(xp);
  if (rank.maxXP === Infinity) return { current: xp - rank.minXP, needed: null, pct: 100 };

  const totalRange = rank.maxXP - rank.minXP + 1;
  if (rank.subRanks === 1) {
    const current = xp - rank.minXP;
    return { current, needed: totalRange, pct: Math.round((current / totalRange) * 100) };
  }

  const perSub = totalRange / rank.subRanks;
  const subStart = rank.minXP + (rank.subRank - 1) * perSub;
  const current = xp - subStart;
  return {
    current: Math.floor(current),
    needed:  Math.floor(perSub),
    pct:     Math.round((current / perSub) * 100),
  };
}

// Rank especial exclusivo do dono da plataforma — não relacionado a XP
export const OWNER_RANK = {
  tier:        'fundador',
  label:       'Fundador',
  icon:        Gem,
  color:       '#f97316',
  glow:        'rgba(249,115,22,0.45)',
  textClass:   'text-orange-400',
  borderWidth: 3,
  subRanks:    1,
  subRank:     1,
};

// Retorna a borda correta: owner sempre laranja, outros baseados em XP
export function getBorderForProfile(profile, xp = null) {
  if (profile?.role === 'owner') return OWNER_RANK;
  if (xp != null) return getRankFromXP(xp);
  return null;
}

export const XP_SOURCES = [
  { icon: FileText,     label: 'Criar um post',       xp: 20, oneTime: false },
  { icon: Heart,        label: 'Receber um like',     xp: 5,  oneTime: false },
  { icon: MessageCircle,label: 'Fazer um comentário', xp: 3,  oneTime: false },
  { icon: Tv,           label: 'Criar uma live',      xp: 50, oneTime: false },
  { icon: PenLine,      label: 'Preencher bio',       xp: 50, oneTime: true  },
  { icon: Camera,       label: 'Definir avatar',      xp: 30, oneTime: true  },
  { icon: Gamepad2,     label: 'Definir plataforma',  xp: 15, oneTime: true  },
  { icon: Hash,         label: 'Conectar Discord',    xp: 15, oneTime: true  },
  { icon: Radio,        label: 'Conectar Twitch',     xp: 15, oneTime: true  },
  { icon: Play,         label: 'Conectar YouTube',    xp: 15, oneTime: true  },
];
