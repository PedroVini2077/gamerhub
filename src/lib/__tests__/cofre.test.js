/**
 * @vitest-environment jsdom
 *
 * O cofre do painel do Fundador.
 *
 * ── O que estes testes cobrem, e o que NÃO ──────────────────────────────────
 *
 * Eles provam o comportamento local: define, confere, abre por aba, esquece.
 * Eles **não** provam segurança nenhuma, porque não há segurança aqui para
 * provar — o cofre é uma tranca de tela, e o que protege o painel são as regras
 * do banco. Ver o cabeçalho de `lib/cofre.js`.
 *
 * O teste que mais importa é o do texto puro: se um dia alguém "simplificar" o
 * hash e passar a guardar o código como está, nada visível quebra — a tela
 * continua abrindo igual. É falha silenciosa clássica (§1.5), e só um teste
 * pega.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  MINIMO_DO_CODIGO, abrirCofre, cofreAberto, cofreArmado, conferirCodigo,
  definirCodigo, esquecerCodigo, fecharCofre,
} from '../cofre';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('definir o código', () => {
  it('recusa código curto demais, com a mensagem do tamanho', async () => {
    const { erro } = await definirCodigo('a'.repeat(MINIMO_DO_CODIGO - 1));
    expect(erro).toContain(String(MINIMO_DO_CODIGO));
    expect(cofreArmado()).toBe(false);
  });

  it('recusa código vazio', async () => {
    expect((await definirCodigo('')).erro).toBeTruthy();
    expect((await definirCodigo(null)).erro).toBeTruthy();
  });

  it('arma o cofre e passa a reconhecer o código', async () => {
    expect(cofreArmado()).toBe(false);
    expect((await definirCodigo('abrete-sesamo')).ok).toBe(true);
    expect(cofreArmado()).toBe(true);
    expect(await conferirCodigo('abrete-sesamo')).toBe(true);
  });

  it('recusa qualquer outro código', async () => {
    await definirCodigo('abrete-sesamo');
    expect(await conferirCodigo('abrete-sesamu')).toBe(false);
    expect(await conferirCodigo('')).toBe(false);
    expect(await conferirCodigo('ABRETE-SESAMO')).toBe(false);
  });

  it('cofre sem código não abre com código nenhum', async () => {
    // Sem isto, um `localStorage` limpo poderia responder `true` para um resumo
    // nulo comparado com outro resumo nulo — e o cofre abriria com qualquer
    // coisa exatamente no aparelho que nunca o configurou.
    expect(await conferirCodigo('qualquer')).toBe(false);
    expect(await conferirCodigo('')).toBe(false);
  });
});

describe('o código nunca é guardado em texto', () => {
  it('não aparece em lugar nenhum do armazenamento', async () => {
    const segredo = 'minha-frase-secreta-123';
    await definirCodigo(segredo);

    const tudo = Object.keys(localStorage)
      .map((k) => `${k}=${localStorage.getItem(k)}`).join('|');

    expect(
      tudo.includes(segredo),
      'O código do cofre foi encontrado em texto puro no localStorage.\n'
      + 'Ele tem que ser guardado só como resumo (SHA-256 com sal). Nada aqui\n'
      + 'quebra na tela se isso mudar — o cofre continua abrindo igual —, então\n'
      + 'este teste e a única coisa que percebe.',
    ).toBe(false);
  });

  it('o mesmo código em dois aparelhos gera resumos diferentes', async () => {
    await definirCodigo('igual-nos-dois');
    const primeiro = localStorage.getItem('gh_cofre_resumo');

    // "Outro aparelho" = outro armazenamento, logo outro sal.
    localStorage.clear();
    await definirCodigo('igual-nos-dois');

    expect(
      localStorage.getItem('gh_cofre_resumo'),
      'Dois aparelhos com o mesmo código produziram o MESMO resumo — o sal não\n'
      + 'está entrando na conta, e o resumo vira consultável em tabela pronta.',
    ).not.toBe(primeiro);
  });
});

describe('o desbloqueio vale por ABA', () => {
  it('abre, e continua aberto até fechar', () => {
    expect(cofreAberto()).toBe(false);
    abrirCofre();
    expect(cofreAberto()).toBe(true);
    fecharCofre();
    expect(cofreAberto()).toBe(false);
  });

  it('mora no sessionStorage, não no localStorage', () => {
    abrirCofre();
    // A diferença é o comportamento inteiro: no `localStorage`, o cofre abriria
    // uma vez e nunca mais pediria código — em nenhum dia, em nenhuma aba.
    expect(sessionStorage.getItem('gh_cofre_aberto')).toBe('1');
    expect(localStorage.getItem('gh_cofre_aberto')).toBe(null);
  });
});

describe('esquecer o código — a inversa (§5)', () => {
  it('desarma o cofre e fecha o que estava aberto', async () => {
    await definirCodigo('vou-esquecer');
    abrirCofre();

    esquecerCodigo();

    expect(cofreArmado()).toBe(false);
    expect(cofreAberto()).toBe(false);
    // O sal vai junto: deixá-lo para trás faria o próximo código herdar o sal
    // do anterior, o que não quebra nada mas é lixo com aparência de dado.
    expect(localStorage.getItem('gh_cofre_sal')).toBe(null);
  });

  it('depois de esquecer, o código antigo não abre mais', async () => {
    await definirCodigo('vou-esquecer');
    esquecerCodigo();
    expect(await conferirCodigo('vou-esquecer')).toBe(false);
  });
});
