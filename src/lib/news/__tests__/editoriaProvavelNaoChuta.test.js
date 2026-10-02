import { describe, it, expect } from 'vitest';
import { sugerirEditoria, evidenciasPara, PISTAS } from '../editoriaProvavel';
import { sugestoesPara } from '../assistente';
import { editoriaValida } from '../editorias';

/**
 * `[02/10]` A SUGESTÃO DE EDITORIA — e o bug que ela existe para não repetir.
 *
 * ── O caso real ───────────────────────────────────────────────────────────
 *
 *     «Diablo IV temporada 15 transforma o jogo em museu dos 30 anos da série»
 *
 * O assistente sugeria **Filmes e Séries**, porque a regra era *"a pista mais
 * longa ganha"* e `temporada` tem 9 letras contra as 4 de `jogo`. **Tamanho de
 * palavra não tem relação nenhuma com o quanto ela informa.**
 *
 * Medido nos seis casos antes do conserto: **4 de 6 errados** — e os 2 que
 * acertavam acertavam pelo motivo errado. `Nova temporada chega em breve`, que
 * não diz de que assunto se trata, devolvia `filmes-series`: palpite com cara
 * de certeza, numa sugestão que vira um clique do editor.
 *
 * ── O que esta trava guarda, e não é a lista de palavras ──────────────────
 *
 * A propriedade é uma: **palavra que ACOMPANHA nunca decide sozinha.** Ela é
 * verificada contra o próprio vocabulário, varrendo `PISTAS` — então uma
 * palavra ambígua acrescentada amanhã entra na checagem sem ninguém lembrar.
 *
 * E o caso do Diablo passa **sem `diablo` estar no vocabulário**, de propósito:
 * se passasse por causa do nome, a trava estaria provando a lista e não a
 * arquitetura, e a classe de erro continuaria viva.
 */

describe('os casos que o conserto precisa resolver', () => {
  it.each([
    ['Diablo IV temporada 15 transforma o jogo em museu dos 30 anos da série', 'gaming'],
    ['Fortnite recebe nova temporada com novos conteúdos', 'gaming'],
    ['Call of Duty anuncia nova temporada', 'gaming'],
    ['Netflix anuncia nova temporada de uma série de sucesso', 'filmes-series'],
    ['Stranger Things ganha nova temporada', 'filmes-series'],
  ])('«%s» → %s', (titulo, esperado) => {
    expect(sugerirEditoria(titulo)).toBe(esperado);
  });

  it('o caso do Diablo passa SEM `diablo` no vocabulario', () => {
    // Se alguem "consertar" acrescentando o nome, este teste avisa que a
    // prova deixou de ser da arquitetura e passou a ser da lista.
    const todas = Object.values(PISTAS).flatMap((p) => [...p.definem, ...p.acompanham]);
    expect(todas, 'o caso que originou o conserto tem de passar pela regra '
      + '(`jogo` define, `temporada` so acompanha) e nao por um nome proprio. '
      + 'Com `diablo` na lista, a classe de erro volta a ficar viva.')
      .not.toContain('diablo');
  });
});

describe('palavra que ACOMPANHA nunca decide sozinha', () => {
  const ambiguas = Object.entries(PISTAS)
    .flatMap(([slug, p]) => p.acompanham.map((palavra) => [slug, palavra]));

  it('o vocabulario tem palavras ambiguas de verdade', () => {
    // Controle: sem ele, esvaziar `acompanham` deixaria o bloco abaixo verde
    // sobre uma lista vazia — a classe "teste que nao consegue falhar".
    expect(ambiguas.length).toBeGreaterThan(5);
  });

  it.each(ambiguas)('«nova %s» sozinha nao vira sugestao (%s)', (_slug, palavra) => {
    expect(sugerirEditoria(`Nova ${palavra} chega em breve`),
      `"${palavra}" acompanha, nao define — sozinha ela tem de devolver null`)
      .toBeNull();
  });

  it('mas ela SOMA quando a editoria ja tem evidencia propria', () => {
    // É isto que torna o resultado contextual: `temporada` vale ao lado de
    // `netflix` e não vale ao lado de `jogo`.
    const comDefinicao = evidenciasPara('Netflix anuncia nova temporada');
    expect(comDefinicao['filmes-series'].acompanham).toContain('temporada');
    expect(comDefinicao['filmes-series'].pontos).toBeGreaterThan(3);

    const semDefinicao = evidenciasPara('Anuncia nova temporada');
    expect(semDefinicao, 'sem pista que define, a editoria nao entra no pareo')
      .toEqual({});
  });
});

describe('o vocabulario e coerente consigo mesmo', () => {
  const porTipo = (tipo) => Object.entries(PISTAS)
    .flatMap(([slug, p]) => p[tipo].map((palavra) => ({ slug, palavra })));

  it('nenhuma palavra DEFINE duas editorias', () => {
    // "Define" quer dizer "pertence a uma editoria e a nenhuma outra". Uma
    // palavra em dois `definem` desmente a propria camada — e produziria
    // empate permanente, que esta funcao resolve calando.
    const vistas = new Map();
    const repetidas = [];
    for (const { slug, palavra } of porTipo('definem')) {
      if (vistas.has(palavra)) repetidas.push(`"${palavra}": ${vistas.get(palavra)} e ${slug}`);
      vistas.set(palavra, slug);
    }
    expect(repetidas, 'palavra em dois `definem` nao define nada. Mova para '
      + '`acompanham` da editoria em que ela e mais tipica.').toEqual([]);
  });

  it('nenhuma palavra esta em `definem` e `acompanham` ao mesmo tempo', () => {
    const definem = new Set(porTipo('definem').map((e) => e.palavra));
    const confusas = porTipo('acompanham')
      .filter((e) => definem.has(e.palavra)).map((e) => e.palavra);
    expect(confusas, 'as duas camadas sao exclusivas: ou a palavra prova '
      + 'sozinha, ou ela so acompanha').toEqual([]);
  });

  it('toda editoria do vocabulario existe de verdade', () => {
    for (const slug of Object.keys(PISTAS)) {
      expect(editoriaValida(slug), `"${slug}" nao esta em EDITORIAS`).toBe(true);
    }
  });
});

describe('na duvida, nao sugere', () => {
  it('empate entre duas editorias devolve null', () => {
    // Uma pista que define de cada lado, e nada que desempate. Sortear aqui
    // seria dar falsa confianca a quem clica no botao.
    const titulo = 'O filme virou jogo';
    const placar = evidenciasPara(titulo);
    expect(Object.keys(placar).sort()).toEqual(['filmes-series', 'gaming']);
    expect(placar.gaming.pontos).toBe(placar['filmes-series'].pontos);
    expect(sugerirEditoria(titulo)).toBeNull();
  });

  it('titulo sem assunto nenhum devolve null', () => {
    for (const neutro of ['Nova temporada chega em breve', 'Comunicado da equipe', '', null]) {
      expect(sugerirEditoria(neutro), `"${neutro}"`).toBeNull();
    }
  });

  it('a sugestao, quando existe, e SEMPRE uma editoria do vocabulario', () => {
    const titulos = ['GPU nova', 'anime de sucesso', 'demissão no estúdio', 'patch do jogo',
      'Netflix anuncia série', 'Xbox recebe atualização'];
    for (const t of titulos) {
      const s = sugerirEditoria(t);
      if (s !== null) expect(editoriaValida(s), `"${s}"`).toBe(true);
    }
  });
});

describe('o corpo entra como apoio, e o titulo continua pesando mais', () => {
  it('o corpo decide quando o titulo nao diz nada', () => {
    expect(sugerirEditoria('A nova temporada chegou')).toBeNull();
    expect(sugerirEditoria('A nova temporada chegou',
      'O jogo ganhou um modo novo e os jogadores ja estao testando.')).toBe('gaming');
  });

  it('o corpo NAO atropela o titulo', () => {
    // Uma pista no titulo (3) tem de ganhar de duas no corpo (1+1).
    expect(sugerirEditoria('Netflix prepara algo novo',
      'O jogo e o gameplay aparecem no trailer.')).toBe('filmes-series');
  });

  it('`sugestoesPara` passa resumo e corpo adiante', () => {
    // Sem isto, a melhoria existiria na funcao e nao chegaria na tela.
    const s = sugestoesPara({
      titulo: 'A nova temporada chegou',
      resumo: 'Tudo sobre o gameplay.',
      conteudo: 'Os jogadores ja podem baixar.',
    });
    expect(s.editoria).toBe('gaming');
  });

  it('a assinatura antiga continua valendo', () => {
    // `sugerirEditoria(titulo)` e chamada assim desde 25/09. O segundo
    // argumento e opcional de proposito.
    expect(sugerirEditoria('Nova GPU da NVIDIA')).toBe('hardware');
  });
});
