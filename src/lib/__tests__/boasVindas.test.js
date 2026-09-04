/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  marcarEntradaAgora, consumirEntradaAgora, ehPrimeiraVez, registrarQueJaEntrou,
  EVENTO_ENTROU,
} from '../boasVindas';

/**
 * Trava da tela de boas-vindas.
 *
 * ── Os dois defeitos que ela impede, e os dois são MUDOS ────────────────────
 *
 * 1. **A tela voltar a cada F5.** Se a marca de "acabou de entrar" for lida sem
 *    ser apagada, todo recarregamento com sessão salva reabre o portão. Não
 *    quebra nada, não loga nada — só transforma um agrado em incômodo, e quem
 *    descobre é quem usa.
 * 2. **Cair onde o armazenamento LANÇA.** Em aba anônima de alguns navegadores
 *    e com cookies de site bloqueados, `sessionStorage` não devolve `null`: ele
 *    **lança**. Sem `try`, a exceção sobe pelo `useAuth` e derruba o login
 *    inteiro — enfeite quebrando a porta de entrada, que é o pior desfecho
 *    possível para uma tela decorativa.
 *
 * O caso 2 é o que justifica o teste existir: ele não aparece em nenhum
 * navegador de desenvolvimento, só no de quem usa.
 */
describe('a marca de "acabou de entrar"', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('é CONSUMIDA na primeira leitura — senão a tela volta a cada F5', () => {
    marcarEntradaAgora();

    expect(consumirEntradaAgora(),
      'a marca não foi lida logo depois de ser escrita').toBe(true);

    expect(consumirEntradaAgora(),
      'a marca sobreviveu à leitura.\n'
      + '  `consumirEntradaAgora` tem que APAGAR, não só ler: enquanto ela\n'
      + '  existir, todo recarregamento de página reabre o portão de\n'
      + '  boas-vindas para quem já está logado (§1.5 — ninguém vai reportar\n'
      + '  isso como bug, vai só achar o site chato).').toBe(false);
  });

  it('AVISA quem estiver ouvindo — e é isso que resolve a corrida', () => {
    // O `user` do Supabase é preenchido ANTES de `signInWithPassword` devolver.
    // Sem este aviso, a tela confere o armazenamento cedo demais, não acha a
    // marca, e nunca mais reconfere — foi assim que o e2e reprovou na primeira
    // execução, com o login funcionando e a tela sem aparecer.
    let avisos = 0;
    const ouvinte = () => { avisos += 1; };
    window.addEventListener(EVENTO_ENTROU, ouvinte);
    try {
      marcarEntradaAgora();
      expect(avisos,
        `marcar a entrada não disparou "${EVENTO_ENTROU}".\n`
        + '  Sem o aviso, a tela de boas-vindas depende da ORDEM em que o\n'
        + '  Supabase preenche o `user` — e essa ordem não é nossa.').toBe(1);
    } finally {
      window.removeEventListener(EVENTO_ENTROU, ouvinte);
    }
  });

  it('sem marca nenhuma, responde false — não inventa entrada', () => {
    expect(consumirEntradaAgora()).toBe(false);
  });

  it('primeira vez vira "já entrou" depois de registrada', () => {
    const id = 'uuid-de-teste';
    expect(ehPrimeiraVez(id), 'usuário novo deveria ser primeira vez').toBe(true);
    registrarQueJaEntrou(id);
    expect(ehPrimeiraVez(id), 'depois de registrado, não é mais estreia').toBe(false);
  });

  it('usuário sem id nunca é tratado como estreia', () => {
    // Guarda contra a saudação de estreia aparecer num estado intermediário,
    // antes de o `user` existir.
    expect(ehPrimeiraVez(undefined)).toBe(false);
    expect(ehPrimeiraVez(null)).toBe(false);
  });
});

describe('quando o armazenamento LANÇA (aba anônima, cookies bloqueados)', () => {
  // `Storage.prototype`, e NÃO `sessionStorage` direto — e isto é medição, não
  // preferência: com `vi.spyOn(sessionStorage, 'setItem')` o jsdom continua
  // executando o método real (o objeto é um Proxy, a propriedade própria não
  // pega). Escrito daquele jeito, ESTE TESTE PASSAVA COM O `try` REMOVIDO —
  // trava que não pega o bug é decoração (§2), e só descobri porque reinjetei.
  beforeEach(() => {
    for (const metodo of ['getItem', 'setItem', 'removeItem']) {
      vi.spyOn(Storage.prototype, metodo).mockImplementation(() => {
        throw new DOMException('acesso negado', 'SecurityError');
      });
    }
  });

  afterEach(() => vi.restoreAllMocks());

  it('nenhuma das quatro funções propaga a exceção', () => {
    const erro = 'o armazenamento lançou e a exceção subiu.\n'
      + '  Ela sobe pelo `useAuth` e derruba o LOGIN — a tela de boas-vindas é\n'
      + '  enfeite, e enfeite não pode quebrar a porta de entrada.';

    expect(() => marcarEntradaAgora(), erro).not.toThrow();
    expect(() => consumirEntradaAgora(), erro).not.toThrow();
    expect(() => ehPrimeiraVez('x'), erro).not.toThrow();
    expect(() => registrarQueJaEntrou('x'), erro).not.toThrow();
  });

  it('e o site segue como se a pessoa já tivesse entrado antes', () => {
    // Errar para "bem-vindo de volta" é menos estranho do que dar boas-vindas
    // de estreia a quem usa o site há meses.
    expect(consumirEntradaAgora()).toBe(false);
    expect(ehPrimeiraVez('x')).toBe(false);
  });
});
