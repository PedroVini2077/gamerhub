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
import { readFileSync } from 'node:fs';
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

/**
 * As INVERSAS precisam estar ALCANÇÁVEIS, não só existir (§5).
 *
 * Este arquivo já provava que `fecharCofre` e `esquecerCodigo` funcionam. Só
 * que uma função exportada que nenhuma tela chama não cumpre o §5 — ele pede a
 * inversa **e quem pode executá-la**. As duas nasceram assim, e as duas foram
 * ligadas depois: `esquecerCodigo` num link do cofre, `fecharCofre` no botão
 * "Trancar" do cabeçalho do painel.
 *
 * A diferença é concreta: sem o botão, a única forma de trancar de novo era
 * fechar a aba — e quem levanta do computador deixa o painel aberto atrás de
 * si, que é exatamente a situação para a qual o cofre existe.
 *
 * Nada denuncia a volta disso: a função continua exportada, os testes dela
 * continuam passando, e o build não repara em botão que sumiu.
 */
describe('as inversas estão ligadas a alguma tela', () => {
  const chamadaEm = (arquivo, funcao) => {
    const codigo = readFileSync(arquivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    return codigo.includes(`${funcao}()`);
  };

  it('`fecharCofre` é chamado pelo painel — o botão "Trancar"', () => {
    expect(
      chamadaEm('src/pages/Owner.jsx', 'fecharCofre'),
      'src/pages/Owner.jsx nao chama fecharCofre().\n'
      + 'Sem isso, a unica forma de trancar de novo e FECHAR A ABA — o cofre\n'
      + 'nao fecha por tempo, de proposito. Quem levanta do computador deixa o\n'
      + 'painel aberto atras de si.',
    ).toBe(true);
  });

  it('`esquecerCodigo` é chamado pela tela do cofre', () => {
    expect(
      chamadaEm('src/components/owner/CofreDoFundador.jsx', 'esquecerCodigo'),
      'CofreDoFundador.jsx nao chama esquecerCodigo().\n'
      + 'Sem isso, esquecer o codigo tranca o dono fora do proprio painel\n'
      + 'naquele navegador ate ele saber abrir o DevTools.',
    ).toBe(true);
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
