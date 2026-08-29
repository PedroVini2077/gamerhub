import { describe, it, expect } from 'vitest';
import { BLOCOS } from '../conteudoDoSobre';
import { iconeDoBloco } from '../iconesDoSobre';

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
  // Inclui `jogos` de propósito: em 29/08 os títulos saíram da prosa e viraram
  // chips na tela. A resposta do dono continua na página — o que mudou foi a
  // FORMA. Um teste que só olhasse parágrafo reprovaria uma mudança correta e,
  // pior, ensinaria a resposta errada: contornar a trava em vez de atualizá-la.
  const tudo = BLOCOS.flatMap(b => [
    b.titulo, b.lema,
    ...(b.paragrafos ?? []),
    ...(b.jogos ?? []).flatMap(j => [j.nome, j.genero]),
  ]).filter(Boolean).join(' ').toLowerCase();

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

/**
 * `[29/08]` A trava dos ícones.
 *
 * Sem ela, um bloco novo entra sem `icone` e a página renderiza um buraco no
 * lugar dele — sem erro, sem log, sem teste vermelho. Ninguém repara num
 * buraco: é falha silenciosa pura (§1.5), na mesma família do bug que deixou
 * esta página inteira invisível no dia em que ela nasceu.
 */
describe('ícones dos blocos', () => {
  it('todo bloco declara um ícone', () => {
    const semIcone = BLOCOS.filter(b => !b.icone).map(b => b.id);
    expect(semIcone, `blocos sem \`icone\`: ${semIcone.join(', ')}. `
      + 'Escolha um ícone do lucide-react, declare-o no bloco e registre-o em '
      + 'components/sobre/iconesDoSobre.js — o mapa é explícito de propósito.')
      .toEqual([]);
  });

  it('todo ícone declarado existe no mapa', () => {
    const orfaos = BLOCOS.filter(b => b.icone && !iconeDoBloco(b.icone))
      .map(b => `${b.id} -> ${b.icone}`);
    expect(orfaos, `ícone declarado que o mapa não conhece: ${orfaos.join(', ')}. `
      + 'Acrescente o import e a entrada em components/sobre/iconesDoSobre.js, '
      + 'senão a página renderiza um buraco em silêncio.')
      .toEqual([]);
  });

  it('os jogos que o dono citou continuam na página', () => {
    const quemFaz = BLOCOS.find(b => b.id === 'quem-faz');
    const nomes = (quemFaz.jogos ?? []).map(j => j.nome.toLowerCase()).join(' | ');
    for (const jogo of ['call of duty', 'battlefield', 'the last of us',
      'god of war', 'metal gear rising']) {
      expect(nomes, `a lista de jogos perdeu "${jogo}" — são os títulos que o `
        + 'dono citou, não uma seleção minha.').toContain(jogo);
    }
  });
});
