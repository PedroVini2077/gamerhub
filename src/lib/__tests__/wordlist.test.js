import { describe, it, expect } from 'vitest';
import { checkText, findBlockedWord, SEVERIDADE_BLOQUEIA } from '../wordlist';

const lista = [
  { word: 'palavraruim', severity: 'high' },
  { word: 'palavrao', severity: 'medium' },
  { word: 'girialeve', severity: 'low' },
  { word: 'termo composto', severity: 'high' },
  { word: 'ass', severity: 'high' },
  { word: 'você', severity: 'high' },
];

describe('checkText — match de palavra inteira', () => {
  it('não casa substring dentro de outra palavra', () => {
    // O motivo de existir o match por palavra inteira: "ass" não pode
    // bloquear "classe", "massa", "passar".
    for (const frase of ['a classe toda', 'muita massa', 'vou passar nivel']) {
      expect(checkText(frase, lista).blocked, frase).toBe(false);
    }
  });

  it('casa a palavra isolada, mesmo colada em pontuação', () => {
    expect(checkText('que ass!', lista).blocked).toBe(true);
    expect(checkText('(ass)', lista).blocked).toBe(true);
  });

  it('ignora maiusculas e minusculas', () => {
    expect(checkText('PALAVRARUIM', lista).blocked).toBe(true);
    expect(checkText('PaLaVrArUiM aqui', lista).blocked).toBe(true);
  });

  it('casa termo com mais de uma palavra', () => {
    expect(checkText('isso e um termo composto sim', lista).blocked).toBe(true);
  });

  it('acento importa — por isso a lista precisa das duas formas', () => {
    expect(checkText('você', lista).blocked).toBe(true);
    expect(checkText('voce', lista).blocked).toBe(false);
  });

  it('texto limpo passa', () => {
    expect(checkText('qual o melhor build pro novo patch', lista)).toEqual({
      blocked: false, word: null, severity: null,
    });
  });

  it('lista vazia ou texto vazio não quebra', () => {
    expect(checkText('', lista).blocked).toBe(false);
    expect(checkText('palavraruim', []).blocked).toBe(false);
    expect(checkText(null, lista).blocked).toBe(false);
    expect(checkText('palavraruim', null).blocked).toBe(false);
  });
});

describe('checkText — severidade decide se barra', () => {
  it('high barra o envio', () => {
    const r = checkText('isso é palavraruim', lista);
    expect(r.blocked).toBe(true);
    expect(r.severity).toBe(SEVERIDADE_BLOQUEIA);
  });

  // A razão de existir a separação: numa comunidade gamer "caralho que jogo
  // foda" é elogio. Barrar o envio por isso afastaria o usuário à toa — a IA
  // julga o contexto, a lista não.
  it('medium NÃO barra, mas reporta o termo', () => {
    const r = checkText('que palavrao hein', lista);
    expect(r.blocked).toBe(false);
    expect(r.word).toBe('palavrao');
    expect(r.severity).toBe('medium');
  });

  it('low NÃO barra', () => {
    expect(checkText('girialeve demais', lista).blocked).toBe(false);
  });

  // Se retornasse o primeiro achado, um `medium` no começo esconderia um
  // `high` mais adiante e o envio passaria.
  it('acha o high mesmo com um medium antes no texto', () => {
    const r = checkText('primeiro palavrao depois palavraruim', lista);
    expect(r.blocked).toBe(true);
    expect(r.word).toBe('palavraruim');
  });
});

describe('findBlockedWord — compatibilidade', () => {
  it('devolve o termo e a severidade encontrados', () => {
    expect(findBlockedWord('tem palavraruim aqui', lista))
      .toEqual({ word: 'palavraruim', severity: 'high' });
  });

  it('devolve null quando não acha', () => {
    expect(findBlockedWord('texto limpo', lista)).toBeNull();
  });
});

// ── Tolerância de plural ─────────────────────────────────────────────────────
//
// Regressão real: o mural aceitou "Se matem otários" inteiro — nem oculto, nem
// na fila. Os dois termos estavam na lista (`se mata` high, `otário` medium),
// mas o casamento é de palavra inteira e `otário` não casa `otários`.
//
// Estas regras precisam ser IDÊNTICAS às do trigger `checar_palavras_bloqueadas`
// no banco. Se divergirem, o cliente deixa passar o que o servidor recusa.
describe('tolerância de plural', () => {
  const lista = [
    { word: 'otário', severity: 'medium' },
    { word: 'idiota', severity: 'medium' },
    { word: 'cu',     severity: 'medium' },
    { word: 'mongol', severity: 'high' },
  ];

  it.each([
    ['bando de otários', 'otário'],
    ['seus idiotas',     'idiota'],
    ['vai tomar no cus', 'cu'],
    ['seus mongoles',    'mongol'],
  ])('casa o plural em "%s"', (texto, esperado) => {
    expect(checkText(texto, lista).word).toBe(esperado);
  });

  it.each(['otário', 'idiota', 'cu', 'mongol'])('continua casando o singular "%s"', termo => {
    expect(checkText(`isso é ${termo} demais`, lista).word).toBe(termo);
  });

  // O sufixo `es` só vale a partir de 4 letras, senão `cu` casaria "cues" —
  // palavra inglesa que aparece em texto sobre jogo ("os cues sonoros").
  it('não casa "cues" com o termo "cu"', () => {
    expect(checkText('os cues sonoros do jogo', lista).word).toBeNull();
  });

  it('não passa a casar substring por causa do sufixo', () => {
    for (const texto of ['classe alta', 'que jogo massa', 'passar de fase', 'o curso começou']) {
      expect(checkText(texto, lista).word).toBeNull();
    }
  });

  it('plural de termo high continua bloqueando o envio', () => {
    expect(checkText('seus mongoles', lista).blocked).toBe(true);
  });
});
