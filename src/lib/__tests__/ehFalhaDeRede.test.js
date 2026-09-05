import { describe, it, expect, afterEach, vi } from 'vitest';
import { ehFalhaDeRede } from '../ehFalhaDeRede';

/**
 * A trava da corrente de três mensagens.
 *
 * O bug: com o aparelho offline, o dono via *"sem acesso ao banco"*, depois
 * *"algo deu errado no site"*, depois a página do navegador. A do meio era
 * mentira — nada deu errado no site, a rede foi embora.
 *
 * ── O que esta trava protege, e é a parte que importa ──────────────────────
 *
 * O risco de classificar erro por frase é **errar para os dois lados**, e os
 * dois são ruins de formas diferentes:
 *
 *   falso POSITIVO ... um bug de verdade é chamado de "sem conexão", não vai
 *                      para o Sentry, e fica invisível. É o pior dos dois.
 *   falso NEGATIVO ... queda de rede volta a ser "algo deu errado", que é o
 *                      bug original.
 *
 * Por isso os dois lados estão travados, e o lado do falso positivo tem mais
 * casos: um `undefined.map()` é `TypeError`, igual ao `fetch` que falha.
 */
describe('ehFalhaDeRede', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  // Sem isto, `navigator.onLine` do ambiente de teste decidiria os casos e o
  // resultado mudaria conforme a máquina. O reforço é testado à parte, abaixo.
  const online = () => vi.stubGlobal('navigator', { onLine: true });

  it('reconhece a frase de cada navegador', () => {
    online();
    const reais = [
      'Failed to fetch',                                   // Chrome / Edge
      'NetworkError when attempting to fetch resource.',   // Firefox
      'Load failed',                                       // Safari
      'The Internet connection appears to be offline.',    // Safari iOS
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_NAME_NOT_RESOLVED',
    ];
    for (const msg of reais) {
      expect(ehFalhaDeRede(new TypeError(msg)),
        `"${msg}" e queda de rede e nao foi reconhecida — a pessoa offline\n`
        + '  voltaria a ver "algo deu errado no site", que e o bug original')
        .toBe(true);
    }
  });

  // ── O lado que mais importa: NÃO confundir bug com rede ──────────────────
  //
  // Se um bug de verdade for classificado como "sem conexao", ele deixa de ir
  // para o Sentry e a tela diz para a pessoa esperar a internet voltar. O bug
  // fica invisivel dos dois lados — e e exatamente a falha silenciosa do §1.5,
  // criada pelo codigo escrito para consertar uma mensagem falsa.
  it('NÃO chama bug de verdade de queda de rede', () => {
    online();
    const bugsReais = [
      new TypeError("Cannot read properties of undefined (reading 'map')"),
      new TypeError('x is not a function'),
      new ReferenceError('foo is not defined'),
      new Error('Minified React error #185'),
      new Error('Rendered more hooks than during the previous render.'),
      new RangeError('Maximum call stack size exceeded'),
    ];
    for (const erro of bugsReais) {
      expect(ehFalhaDeRede(erro),
        `"${erro.message}" e BUG DO SITE e foi classificado como rede.\n`
        + '  Consequencia: nao vai para o Sentry, e a tela manda a pessoa\n'
        + '  esperar a internet voltar. O bug fica invisivel dos dois lados.')
        .toBe(false);
    }
  });

  it('offline declarado pelo navegador conta, mesmo com erro estranho', () => {
    // `navigator.onLine === false` é prova de offline. Nesse instante,
    // qualquer erro é consequência da rede.
    vi.stubGlobal('navigator', { onLine: false });
    expect(ehFalhaDeRede(new Error('qualquer coisa'))).toBe(true);
  });

  it('mas `onLine: true` NÃO é prova de nada', () => {
    // Ele continua `true` com Wi-Fi ligado num roteador sem internet — é por
    // isso que ele é reforço, e não a resposta.
    online();
    expect(ehFalhaDeRede(new Error('erro de negocio qualquer'))).toBe(false);
  });

  it('não estoura com entrada esquisita', () => {
    online();
    for (const x of [null, undefined, '', 0, {}, []]) {
      expect(() => ehFalhaDeRede(x)).not.toThrow();
      expect(ehFalhaDeRede(x)).toBe(false);
    }
  });
});
