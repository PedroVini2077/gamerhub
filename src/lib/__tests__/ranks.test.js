import { describe, it, expect } from 'vitest';
import {
  getRankFromXP, getRankLabel, getSubRankProgress, getBorderForProfile, OWNER_RANK,
} from '../ranks';

describe('getRankFromXP', () => {
  it('XP 0 é Recruta I', () => {
    const r = getRankFromXP(0);
    expect(r.tier).toBe('recruta');
    expect(r.subRank).toBe(1);
  });

  it('topo do tier cai no último sub-rank', () => {
    expect(getRankFromXP(199).subRank).toBe(4); // fim de Recruta
    expect(getRankFromXP(50).subRank).toBe(2);
  });

  it('faz a transição de tier no limite', () => {
    expect(getRankFromXP(200).tier).toBe('veterano');
    expect(getRankFromXP(500).tier).toBe('guerreiro');
    expect(getRankFromXP(8000).tier).toBe('deus');
  });

  it('XP negativo/indefinido cai no menor tier', () => {
    expect(getRankFromXP().tier).toBe('recruta');
    expect(getRankFromXP(-100).tier).toBe('recruta');
  });
});

describe('getRankLabel', () => {
  it('tiers de 1 sub-rank não mostram numeral', () => {
    expect(getRankLabel(getRankFromXP(8000))).toBe('Deus do Jogo');
  });
  it('tiers com sub-ranks mostram numeral romano', () => {
    expect(getRankLabel(getRankFromXP(0))).toBe('Recruta I');
    expect(getRankLabel(getRankFromXP(199))).toBe('Recruta IV');
  });
  it('sem rank retorna travessão', () => {
    expect(getRankLabel(null)).toBe('—');
  });
});

describe('getSubRankProgress', () => {
  it('tier infinito (Deus) fica 100%', () => {
    const p = getSubRankProgress(8000);
    expect(p.pct).toBe(100);
    expect(p.needed).toBe(null);
  });
  it('início de tier fica em 0%', () => {
    expect(getSubRankProgress(0).pct).toBe(0);
  });
});

describe('getBorderForProfile', () => {
  it('owner sempre recebe a borda de Fundador', () => {
    expect(getBorderForProfile({ role: 'owner' })).toBe(OWNER_RANK);
    // owner ignora XP
    expect(getBorderForProfile({ role: 'owner' }, 0)).toBe(OWNER_RANK);
  });
  it('usuário comum usa XP', () => {
    expect(getBorderForProfile({ role: 'user' }, 250).tier).toBe('veterano');
  });
  it('sem XP e sem owner retorna null', () => {
    expect(getBorderForProfile({ role: 'user' }, null)).toBe(null);
    expect(getBorderForProfile(null)).toBe(null);
  });
});
