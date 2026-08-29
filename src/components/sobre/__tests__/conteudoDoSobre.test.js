import { describe, it, expect } from 'vitest';
import { BLOCOS } from '../conteudoDoSobre';

/**
 * Trava do conteúdo da página "Sobre".
 *
 * ── Por que uma página de texto precisa de teste ────────────────────────────
 *
 * Porque o modo de ela quebrar é silencioso: um bloco com `pendente: false` e
 * sem parágrafos renderiza **um título sozinho**, sem erro nenhum. Quem lê vê
 * uma seção vazia e não sabe se falta texto ou se é assim mesmo.
 *
 * O mesmo vale ao contrário: um bloco `pendente: true` sem `dica` mostra o
 * aviso "esta parte ainda vai ser escrita" sem dizer o que entra ali — e o
 * aviso existe justamente para dizer.
 *
 * ── O que este arquivo NÃO garante ─────────────────────────────────────────
 *
 * Que o texto esteja bom. Isso é do dono, e ele escreveu.
 */

describe('todo bloco chega inteiro na tela', () => {
  it('há blocos', () => {
    expect(BLOCOS.length).toBeGreaterThan(0);
  });

  it.each(BLOCOS.map(b => [b.id, b]))('o bloco `%s` está completo', (id, bloco) => {
    expect(bloco.titulo, `bloco "${id}" sem título`).toBeTruthy();

    if (bloco.pendente) {
      expect(
        bloco.dica,
        `O bloco "${id}" está marcado como pendente e não diz o que entra ali.\n`
        + 'O aviso na tela existe para dizer qual texto falta — sem a dica ele\n'
        + 'vira só "falta alguma coisa aqui".',
      ).toBeTruthy();
      return;
    }

    expect(
      bloco.paragrafos?.length,
      `O bloco "${id}" não está pendente e não tem parágrafo nenhum.\n`
      + 'Ele renderiza um TÍTULO SOZINHO, sem erro — e quem lê não sabe se\n'
      + 'falta texto ou se é assim mesmo.',
    ).toBeGreaterThan(0);

    for (const p of bloco.paragrafos) {
      expect(typeof p, `bloco "${id}" tem parágrafo que não é texto`).toBe('string');
      expect(p.trim().length, `bloco "${id}" tem parágrafo vazio`).toBeGreaterThan(0);
    }
  });

  it('não há id repetido — eles viram âncora na página', () => {
    const ids = BLOCOS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('as respostas do dono chegaram na página', () => {
  const tudo = BLOCOS.flatMap(b => [b.titulo, b.lema, ...(b.paragrafos ?? [])])
    .filter(Boolean).join(' ').toLowerCase();

  // Cada um destes foi uma pergunta que ficou em aberto e que ele respondeu em
  // 29/08. Se sumirem do texto, a página volta a não responder o que se propôs.
  it.each([
    ['o espírito da comunidade', 'respeito, risos e muito gaming'],
    ['os jogos que ele curte', 'metal gear rising'],
    ['a construção com IA, explícita', 'inteligência artificial'],
    ['o nome dele', 'pedro'],
  ])('a página diz %s', (_oQue, trecho) => {
    expect(
      tudo,
      `A página deixou de mencionar "${trecho}".\n`
      + 'Isso veio de uma resposta direta do dono a uma pergunta que a própria\n'
      + 'página tinha deixado em aberto — não é enfeite, é o conteúdo.',
    ).toContain(trecho);
  });

  it('nenhum bloco continua pendente', () => {
    const pendentes = BLOCOS.filter(b => b.pendente).map(b => b.id);
    expect(
      pendentes,
      `Blocos ainda pendentes: ${pendentes.join(', ')}.\n`
      + 'Se isso for intencional (bloco novo esperando texto), tudo bem — mas\n'
      + 'confira se não é um bloco que já foi respondido e ficou marcado errado.',
    ).toEqual([]);
  });
});
