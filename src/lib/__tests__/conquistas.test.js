/**
 * As conquistas do perfil.
 *
 * ── O teste que mais importa é o do dado FALTANDO ───────────────────────────
 *
 * As conquistas são derivadas de `get_user_xp`, que é uma chamada assíncrona.
 * Enquanto ela não volta, a tentação é tratar tudo como zero — e aí quem já tem
 * sete conquistas vê sete cadeados por um instante a cada carregamento. É
 * fallback silencioso (§4): o site afirmando algo falso sobre a pessoa porque
 * ainda não sabe a verdade.
 *
 * Nada na tela denuncia isso: não estoura, não loga, e o piscar é rápido demais
 * para alguém reclamar. Só um teste pega.
 */
import { describe, expect, it } from 'vitest';

import { CONQUISTAS, avaliarConquistas, contarConcluidas } from '../conquistas';

/** Um payload de `get_user_xp` com tudo zerado, para partir dele. */
const zerado = { xp: 0, posts: 0, likes: 0, comments: 0, lives: 0, profile_bonus: 0 };

const perfilCheio = {
  bio: 'jogo desde os 8', avatar_url: 'http://x/y.png', platform: 'PC',
  discord: 'a#1', twitch: 'b', youtube: 'c',
  created_at: new Date(Date.now() - 400 * 86400000).toISOString(),
};

const acha = (lista, id) => lista.find((c) => c.id === id);

describe('dado faltando NÃO vira zero', () => {
  it('devolve null enquanto o XP não chegou', () => {
    expect(avaliarConquistas(null, perfilCheio)).toBe(null);
    expect(avaliarConquistas(undefined, perfilCheio)).toBe(null);
  });

  it('devolve null para um objeto que não é um payload de XP', () => {
    // O caso real: a RPC falha e o hook guarda `{}` em vez de deixar `null`.
    // Sem esta guarda, `xp.posts` seria `undefined`, viraria 0, e a tela
    // afirmaria que a pessoa não publicou nada.
    expect(avaliarConquistas({}, perfilCheio)).toBe(null);
    expect(avaliarConquistas({ xp: 500 }, perfilCheio)).toBe(null);
  });

  it('o resumo também responde null, e não "0 de 8"', () => {
    expect(contarConcluidas(null)).toBe(null);
  });
});

describe('as contagens', () => {
  it('conta zero conquistas para uma conta recém-criada', () => {
    const r = avaliarConquistas(zerado, { created_at: new Date().toISOString() });
    expect(contarConcluidas(r)).toEqual({ feitas: 0, total: CONQUISTAS.length });
  });

  it('o primeiro post conclui uma e adianta a de dez', () => {
    const r = avaliarConquistas({ ...zerado, posts: 1 }, {});
    expect(acha(r, 'primeiro_post').concluida).toBe(true);
    expect(acha(r, 'dez_posts').concluida).toBe(false);
    expect(acha(r, 'dez_posts').progresso).toBe(10);
  });

  it('o progresso não passa de 100% nem o valor da meta', () => {
    // Sem o teto, alguém com 400 posts veria "400 / 10" e uma barra estourada.
    const r = avaliarConquistas({ ...zerado, posts: 400 }, {});
    const dez = acha(r, 'dez_posts');
    expect(dez.progresso).toBe(100);
    expect(dez.valor).toBe(10);
  });

  it('perfil completo conta os seis campos, e espaço em branco não vale', () => {
    expect(acha(avaliarConquistas(zerado, perfilCheio), 'perfil_completo').concluida).toBe(true);

    const comBioVazia = { ...perfilCheio, bio: '   ' };
    const r = acha(avaliarConquistas(zerado, comBioVazia), 'perfil_completo');
    expect(r.concluida).toBe(false);
    expect(r.valor).toBe(5);
  });

  it('um mês de casa: 29 dias não bastam, 30 bastam', () => {
    const emDias = (d) => ({ created_at: new Date(Date.now() - d * 86400000 - 1000).toISOString() });
    expect(acha(avaliarConquistas(zerado, emDias(29)), 'um_mes_de_casa').concluida).toBe(false);
    expect(acha(avaliarConquistas(zerado, emDias(30)), 'um_mes_de_casa').concluida).toBe(true);
  });

  it('sem data de criação, o tempo de casa é 0 — não é conquista de graça', () => {
    const r = acha(avaliarConquistas(zerado, {}), 'um_mes_de_casa');
    expect(r.valor).toBe(0);
    expect(r.concluida).toBe(false);
  });

  it('perfil ausente não derruba a avaliação', () => {
    // O perfil pode não ter chegado junto com o XP. As conquistas que dependem
    // só do XP têm que continuar respondendo.
    const r = avaliarConquistas({ ...zerado, posts: 3 }, null);
    expect(acha(r, 'primeiro_post').concluida).toBe(true);
    expect(acha(r, 'perfil_completo').valor).toBe(0);
  });
});

describe('a lista em si', () => {
  it('não tem id repetido', () => {
    // Id repetido quebraria a `key` do React e faria duas conquistas
    // compartilharem estado de render — sem erro nenhum na tela.
    const ids = CONQUISTAS.map((c) => c.id);
    expect(new Set(ids).size, `ids repetidos em CONQUISTAS: ${ids.join(', ')}`)
      .toBe(ids.length);
  });

  it('toda conquista tem nome, descrição, ícone, cor e meta acima de zero', () => {
    const incompletas = CONQUISTAS.filter(
      (c) => !c.nome || !c.descricao || !c.Icon || !c.cor || !(c.meta > 0)
        || typeof c.medir !== 'function',
    );
    expect(
      incompletas.map((c) => c.id),
      'conquista sem campo obrigatório: ela renderizaria vazia, sem erro nenhum',
    ).toEqual([]);
  });

  it('nenhuma conquista usa emoji — a UI é só lucide-react (§4)', () => {
    const comEmoji = CONQUISTAS.filter(
      (c) => /\p{Extended_Pictographic}/u.test(`${c.nome}${c.descricao}`),
    );
    expect(comEmoji.map((c) => c.id)).toEqual([]);
  });
});
