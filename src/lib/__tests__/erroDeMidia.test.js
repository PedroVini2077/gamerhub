import { describe, it, expect } from 'vitest';
import { descreverErroDeMidia } from '../erroDeMidia';

/**
 * Trava da mensagem de erro de mídia.
 *
 * ── O que ela impede ────────────────────────────────────────────────────────
 *
 * Que os quatro `MediaError` voltem a virar uma frase só. Em 29/08 o aviso na
 * tela dizia "o navegador não decodificou o arquivo" para qualquer um deles —
 * inclusive para `MEDIA_ERR_ABORTED`, que naquele momento podia ter sido
 * causado pelo NOSSO código (um `load()` redundante depois do `src`).
 *
 * Mensagem que mente manda investigar o lugar errado (§1.5). Os quatro têm
 * correções diferentes: código 1 é bug nosso, 2 é a fonte, 3 é o arquivo, 4 é
 * o codec.
 */
describe('descreverErroDeMidia — cada código diz uma coisa diferente', () => {
  it('separa os quatro códigos', () => {
    const ditos = [1, 2, 3, 4].map(code => descreverErroDeMidia({ code }));
    expect(new Set(ditos).size, 'dois códigos produziram a mesma frase').toBe(4);
    expect(ditos[0]).toMatch(/ABORTED/);
    expect(ditos[1]).toMatch(/NETWORK/);
    expect(ditos[2]).toMatch(/DECODE/);
    expect(ditos[3]).toMatch(/SRC_NOT_SUPPORTED/);
  });

  it('o código 1 aponta para o nosso próprio código, não para o arquivo', () => {
    expect(
      descreverErroDeMidia({ code: 1 }),
      'ABORTED significa que ALGUÉM cancelou a carga — e o único alguém aqui\n'
      + 'somos nós. Descrevê-lo como problema do arquivo manda procurar codec\n'
      + 'quando o bug está no nosso `load()`.',
    ).toMatch(/cancelada/);
  });

  it('anexa a mensagem do navegador quando ela existe', () => {
    expect(descreverErroDeMidia({ code: 4, message: 'Format error' }))
      .toBe('MEDIA_ERR_SRC_NOT_SUPPORTED (formato ou codec não suportado): Format error');
  });

  it('código novo aparece como DESCONHECIDO, não como um dos quatro', () => {
    expect(
      descreverErroDeMidia({ code: 9 }),
      'Um código fora da tabela caiu silenciosamente num dos conhecidos.\n'
      + 'É o fallback silencioso do §4: a mensagem passaria a afirmar uma causa\n'
      + 'que ninguém verificou.',
    ).toMatch(/desconhecido 9/);
  });

  it('sem MediaError, diz que não sabe — em vez de escolher', () => {
    expect(descreverErroDeMidia(null)).toMatch(/não disse o motivo/);
    expect(descreverErroDeMidia(undefined)).toMatch(/não disse o motivo/);
  });
});
