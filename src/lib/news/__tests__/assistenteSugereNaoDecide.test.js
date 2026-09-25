import { describe, it, expect } from 'vitest';
import {
  sugerirEditoria, resumoAutomatico, avisosDaMateria, sugestoesPara, TETO_DO_RESUMO,
} from '../assistente';
import { editoriaValida } from '../editorias';

/**
 * `[25/09]` O ASSISTENTE SUGERE — ele nunca decide, e nunca inventa.
 *
 * ── A propriedade que esta trava existe para guardar ──────────────────────
 *
 * O dono aprovou recomendação no painel do News. A linha combinada é dura e é
 * ela que precisa sobreviver a qualquer mexida futura:
 *
 *   tudo o que o assistente devolve vem do texto que a PESSOA já escreveu.
 *
 * No dia em que alguém plugar um modelo aqui, a tentação óbvia é deixá-lo
 * escrever a matéria a partir do título. Isso produziria fato inventado com a
 * marca do GamerHub assinando — e a landing promete o contrário, na letra:
 * "apurado pela equipe, sem caça-clique e sem repost sem fonte".
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `sugerirEditoria` com `?? 'gaming'` no fim  -> falhou no título neutro
 *   . casamento sem fronteira de palavra          -> falhou em "familia" -> ia
 *   . resumo cortando no meio da palavra          -> falhou na checagem de corte
 */

describe('o assistente sugere a partir do que já existe', () => {
  it('editoria: casa palavra INTEIRA, e a pista mais longa ganha', () => {
    expect(sugerirEditoria('Nova GPU da NVIDIA chega em novembro')).toBe('hardware');
    expect(sugerirEditoria('O filme de Zelda ganhou data')).toBe('filmes-series');
    // "inteligência artificial" tem de ganhar de "ia" solto.
    expect(sugerirEditoria('Inteligência artificial no desenvolvimento')).toBe('ia');
  });

  it('NÃO chuta: título sem pista devolve null', () => {
    // Este é o coração da trava. `?? 'gaming'` no fim da função faria toda
    // matéria nascer numa editoria que ninguém escolheu — e campo já
    // preenchido é campo que ninguém confere.
    for (const neutro of ['Uma novidade por aqui', 'Comunicado da equipe', '', null]) {
      expect(sugerirEditoria(neutro), `"${neutro}" nao tem pista`).toBeNull();
    }
  });

  it('editoria sugerida SEMPRE existe no vocabulário', () => {
    const titulos = ['GPU nova', 'anime de sucesso', 'demissão no estúdio', 'patch do jogo'];
    for (const t of titulos) {
      const s = sugerirEditoria(t);
      if (s !== null) expect(editoriaValida(s), `"${s}" precisa existir em EDITORIAS`).toBe(true);
    }
  });

  it('"ia" não casa dentro de outra palavra', () => {
    // Sem fronteira de palavra, "familia", "policia" e "midia" virariam IA.
    for (const falso of ['A familia toda jogou', 'A policia confirmou', 'A midia repercutiu']) {
      expect(sugerirEditoria(falso), `"${falso}" nao e sobre IA`).not.toBe('ia');
    }
  });

  it('resumo sai do CORPO e vem sem marcação', () => {
    const corpo = 'A **nova** GPU chegou. Ela custa *caro* e vem com [3 saídas](https://x.com).';
    const r = resumoAutomatico(corpo);
    expect(r).not.toMatch(/\*|\[|\]\(/);
    expect(r).toContain('nova GPU chegou');
    expect(r).toContain('3 saídas');
  });

  it('resumo longo corta em fronteira, nunca no meio da palavra', () => {
    const frase = 'A placa chegou e mudou tudo para quem joga no computador. ';
    const r = resumoAutomatico(frase.repeat(20));

    expect(r.length).toBeLessThanOrEqual(TETO_DO_RESUMO + 1);
    // Ou termina uma frase, ou termina com reticências — nunca no meio.
    expect(r, `cortou no meio: ...${r.slice(-30)}`).toMatch(/[.!?]$|…$/);
  });

  it('corpo vazio devolve resumo vazio, não um placeholder', () => {
    for (const nada of ['', '   ', null, undefined]) {
      expect(resumoAutomatico(nada)).toBe('');
    }
  });

  it('os avisos apontam o que falta, e a FONTE vem primeiro', () => {
    const avisos = avisosDaMateria({ titulo: 'x', conteudo: 'curto', resumo: '', fonte_url: '', capa_url: '' });
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos[0], 'falta de fonte e a unica que contradiz o que a landing promete').toMatch(/fonte/i);
  });

  it('matéria completa não gera aviso nenhum', () => {
    // Sem isto, a trava passaria com uma função que devolve aviso sempre.
    expect(avisosDaMateria({
      titulo: 'Um título de tamanho normal',
      conteudo: 'a'.repeat(400),
      resumo: 'Tem resumo.',
      fonte_url: 'https://exemplo.com',
      capa_url: 'https://exemplo.com/capa.jpg',
    })).toEqual([]);
  });

  it('não sugere resumo quando a pessoa já escreveu um', () => {
    const s = sugestoesPara({ titulo: 'GPU nova', conteudo: 'Corpo longo aqui.', resumo: 'O meu resumo' });
    expect(s.resumo, 'sobrescrever o que a pessoa escreveu e decidir por ela').toBeNull();
  });
});
